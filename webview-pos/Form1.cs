using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Media;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace webview_pos
{
    public partial class Form1 : Form
    {
        private WebView2? webView;
        private bool isFullScreen = false;
        private FormWindowState previousWindowState = FormWindowState.Maximized;
        private FormBorderStyle previousBorderStyle = FormBorderStyle.Sizable;

        #region Win32 Native APIs for Unstoppable Bring-To-Front

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll")]
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        private static extern bool FlashWindow(IntPtr hwnd, bool bInvert);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const int SW_RESTORE = 9;
        private const int SW_SHOW = 5;

        #endregion

        public Form1()
        {
            InitializeComponent();
            SetupFormProperties();
            InitializeWebViewAsync();
        }

        private void SetupFormProperties()
        {
            this.Text = "نظام استقبال وتجهيز طلبات الفروع | كاشير وإدارة الفرع | UniFood Branch";
            this.StartPosition = FormStartPosition.CenterScreen;
            this.WindowState = FormWindowState.Maximized;
            this.MinimumSize = new Size(1024, 650);

            // تعيين الأيقونة إن وجدت
            try
            {
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.ico");
                if (File.Exists(iconPath))
                {
                    this.Icon = new Icon(iconPath);
                }
            }
            catch { }

            this.KeyPreview = true;
            this.KeyDown += Form1_KeyDown;
        }

        private void Form1_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F11)
            {
                ToggleFullScreen();
                e.Handled = true;
            }
            else if (e.KeyCode == Keys.Escape && isFullScreen)
            {
                SetFullScreen(false);
                e.Handled = true;
            }
        }

        private async void InitializeWebViewAsync()
        {
            try
            {
                webView = new WebView2
                {
                    Dock = DockStyle.Fill
                };
                this.Controls.Add(webView);

                // مجلد بيانات المستخدم المستقل لضمان حفظ بيانات تسجيل الدخول والكاش دائماً
                string userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "UniFoodPOS_WebView2_UserData"
                );
                Directory.CreateDirectory(userDataFolder);

                var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webView.EnsureCoreWebView2Async(environment);

                // إعدادات الـ WebView
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; // تعطيل كليك يمين
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;

                // حقن كود جافاسكريبت لربط واجهة الويب مباشرة بويندوز والتوافق مع electronAPI
                string bridgeScript = @"
                    window.__isWebView2Host = true;
                    window.chrome = window.chrome || {};
                    window.chrome.webview = window.chrome.webview || {};

                    window.electronAPI = {
                        isElectron: true,
                        isWebView2: true,
                        send: function(channel, data) {
                            try {
                                window.chrome.webview.postMessage({ action: channel, data: data });
                            } catch (e) {}
                        },
                        invoke: function(channel, data) {
                            try {
                                window.chrome.webview.postMessage({ action: channel, data: data });
                            } catch (e) {}
                            if (channel === 'is-always-on-top') {
                                return Promise.resolve(window.__pos_always_on_top || false);
                            }
                            if (channel === 'print-receipt-silent') {
                                window.print();
                                return Promise.resolve({ success: true, methodUsed: 'silent' });
                            }
                            return Promise.resolve(null);
                        },
                        on: function(channel, callback) {
                            return function() {};
                        }
                    };
                ";
                await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript);

                // الاستماع للأوامر القادمة من الواجهة
                webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                // تحديد الرابط المناسب (محلي أو سحابي مباشر)
                string targetUrl = await DetermineTargetUrlAsync();
                webView.CoreWebView2.Navigate(targetUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "حدث خطأ أثناء تهيئة محرك WebView2:\n" + ex.Message + "\n\nتأكد من تحديث نظام الويندوز أو وجود Microsoft Edge على جهازك.",
                    "خطأ تشغيل UniFood POS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private async Task<string> DetermineTargetUrlAsync()
        {
            // 1. فحص إذا كان السيرفر المحلي يعمل على بورت 5000 (للتطوير المحلي)
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(800) };
                var res = await client.GetAsync("http://localhost:5000/branch/");
                if (res.IsSuccessStatusCode)
                {
                    return "http://localhost:5000/branch/";
                }
            }
            catch { }

            // 2. استخدام السيرفر السحابي المباشر
            return "https://unifood.store/branch/";
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string json = e.WebMessageAsJson;
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                string action = "";
                if (root.TryGetProperty("action", out var actionProp))
                {
                    action = actionProp.GetString() ?? "";
                }

                switch (action)
                {
                    case "bring-to-front":
                    case "new-order":
                    case "window-focus":
                        ForceBringToFront();
                        break;

                    case "set-always-on-top":
                        if (root.TryGetProperty("value", out var valProp))
                        {
                            SetAlwaysOnTop(valProp.GetBoolean());
                        }
                        else
                        {
                            SetAlwaysOnTop(true);
                        }
                        break;

                    case "toggle-always-on-top":
                        SetAlwaysOnTop(!this.TopMost);
                        break;

                    case "set-fullscreen":
                        if (root.TryGetProperty("value", out var fsProp))
                        {
                            SetFullScreen(fsProp.GetBoolean());
                        }
                        else
                        {
                            SetFullScreen(true);
                        }
                        break;

                    case "toggle-fullscreen":
                        ToggleFullScreen();
                        break;

                    case "print-receipt":
                    case "print-receipt-silent":
                        if (webView != null)
                        {
                            _ = webView.CoreWebView2.ExecuteScriptAsync("window.print();");
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebView2 Message Error] " + ex.Message);
            }
        }

        public void ForceBringToFront()
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(ForceBringToFront));
                return;
            }

            try
            {
                // أ. استعادة النافذة إن كانت مصغرة
                if (this.WindowState == FormWindowState.Minimized)
                {
                    ShowWindow(this.Handle, SW_RESTORE);
                }
                else
                {
                    ShowWindow(this.Handle, SW_SHOW);
                }

                this.Visible = true;

                // ب. استخدام تكنيك ربط خيط الإدخال (AttachThreadInput) لإجبار الويندوز على تقديم النافذة قسراً
                IntPtr hCurrentWindow = this.Handle;
                IntPtr hForegroundWindow = GetForegroundWindow();

                uint foregroundThreadId = GetWindowThreadProcessId(hForegroundWindow, out _);
                uint currentThreadId = GetCurrentThreadId();

                if (foregroundThreadId != currentThreadId && foregroundThreadId != 0)
                {
                    AttachThreadInput(currentThreadId, foregroundThreadId, true);
                    SetForegroundWindow(hCurrentWindow);
                    BringWindowToTop(hCurrentWindow);
                    SwitchToThisWindow(hCurrentWindow, true);
                    AttachThreadInput(currentThreadId, foregroundThreadId, false);
                }
                else
                {
                    SetForegroundWindow(hCurrentWindow);
                    BringWindowToTop(hCurrentWindow);
                }

                // ج. تثبيت النافذة في الواجهة العليا
                SetWindowPos(hCurrentWindow, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);

                // د. وميض شريط المهام لتنبيه الكاشير
                FlashWindow(hCurrentWindow, true);

                // هـ. تشغيل تنبيه صوتي من النظام
                try { SystemSounds.Exclamation.Play(); } catch { }

                this.Activate();
                this.Focus();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[ForceBringToFront Error] " + ex.Message);
            }
        }

        public void SetAlwaysOnTop(bool enable)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action<bool>(SetAlwaysOnTop), enable);
                return;
            }

            this.TopMost = enable;
            IntPtr insertAfter = enable ? HWND_TOPMOST : HWND_NOTOPMOST;
            SetWindowPos(this.Handle, insertAfter, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        }

        public void SetFullScreen(bool full)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action<bool>(SetFullScreen), full);
                return;
            }

            if (full && !isFullScreen)
            {
                previousWindowState = this.WindowState;
                previousBorderStyle = this.FormBorderStyle;

                this.FormBorderStyle = FormBorderStyle.None;
                this.WindowState = FormWindowState.Normal;
                this.WindowState = FormWindowState.Maximized;
                isFullScreen = true;
            }
            else if (!full && isFullScreen)
            {
                this.FormBorderStyle = previousBorderStyle;
                this.WindowState = previousWindowState;
                isFullScreen = false;
            }
        }

        public void ToggleFullScreen()
        {
            SetFullScreen(!isFullScreen);
        }
    }
}
