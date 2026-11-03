using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Printing;
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
        private WebView2? printWebView;
        private CoreWebView2Environment? webViewEnvironment;
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

            // تشغيل التطبيق تلقائياً في وضع ملء الشاشة الكامل بدون فريم (Borderless Fullscreen POS)
            this.FormBorderStyle = FormBorderStyle.None;
            this.WindowState = FormWindowState.Normal;
            this.WindowState = FormWindowState.Maximized;
            this.isFullScreen = true;
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

                webViewEnvironment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webView.EnsureCoreWebView2Async(webViewEnvironment);

                // تهيئة WebView خفي مخصص لطباعة البونات الحرارية بشكل مستقل تماماً
                try
                {
                    printWebView = new WebView2
                    {
                        Size = new Size(380, 600),
                        Visible = false
                    };
                    this.Controls.Add(printWebView);
                    await printWebView.EnsureCoreWebView2Async(webViewEnvironment);
                    printWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                    printWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                    printWebView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                }
                catch (Exception pEx)
                {
                    Debug.WriteLine("[PrintWebView Init Notice] " + pEx.Message);
                }

                // إعدادات الـ WebView الأساسي
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; // تعطيل كليك يمين
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;

                // حقن كود جافاسكريبت لربط واجهة الويب مباشرة بويندوز والتوافق مع electronAPI
                string bridgeScript = @"
                    (function() {
                        window.__isWebView2Host = true;
                        window.chrome = window.chrome || {};
                        window.chrome.webview = window.chrome.webview || {};

                        var pendingIpc = new Map();
                        var ipcSeq = 1;

                        window.electronAPI = {
                            isElectron: true,
                            isWebView2: true,
                            send: function(channel, data) {
                                try {
                                    window.chrome.webview.postMessage({ action: channel, data: data });
                                } catch (e) {}
                            },
                            invoke: function(channel, data) {
                                return new Promise(function(resolve) {
                                    var reqId = ipcSeq++;
                                    pendingIpc.set(reqId, resolve);
                                    try {
                                        window.chrome.webview.postMessage({ id: reqId, action: channel, data: data });
                                    } catch (e) {
                                        pendingIpc.delete(reqId);
                                        resolve(null);
                                    }
                                    setTimeout(function() {
                                        if (pendingIpc.has(reqId)) {
                                            pendingIpc.delete(reqId);
                                            resolve({ success: false, failureReason: 'Timeout' });
                                        }
                                    }, 15000);
                                });
                            },
                            on: function(channel, callback) {
                                return function() {};
                            }
                        };

                        window.__onIpcResponse = function(reqId, result) {
                            if (pendingIpc.has(reqId)) {
                                var resolver = pendingIpc.get(reqId);
                                pendingIpc.delete(reqId);
                                resolver(result);
                            }
                        };
                    })();
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

        private async void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string json = e.WebMessageAsJson;
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                int reqId = 0;
                if (root.TryGetProperty("id", out var idProp) && idProp.ValueKind == JsonValueKind.Number)
                {
                    reqId = idProp.GetInt32();
                }

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
                        SendIpcResponse(reqId, new { success = true });
                        break;

                    case "is-always-on-top":
                        SendIpcResponse(reqId, this.TopMost);
                        break;

                    case "set-always-on-top":
                        {
                            bool enableTop = false;
                            if (root.TryGetProperty("value", out var valProp))
                            {
                                enableTop = valProp.GetBoolean();
                            }
                            else if (root.TryGetProperty("data", out var dProp))
                            {
                                if (dProp.ValueKind == JsonValueKind.True) enableTop = true;
                                else if (dProp.ValueKind == JsonValueKind.False) enableTop = false;
                                else if (dProp.ValueKind == JsonValueKind.Object && dProp.TryGetProperty("value", out var innerVal))
                                {
                                    enableTop = innerVal.GetBoolean();
                                }
                            }
                            SetAlwaysOnTop(enableTop);
                            SendIpcResponse(reqId, this.TopMost);
                        }
                        break;

                    case "toggle-always-on-top":
                        SetAlwaysOnTop(!this.TopMost);
                        SendIpcResponse(reqId, this.TopMost);
                        break;

                    case "get-system-printers":
                        var printers = GetSystemPrintersList();
                        SendIpcResponse(reqId, printers);
                        break;

                    case "print-receipt-silent":
                    case "print-receipt":
                        {
                            string html = "";
                            string deviceName = "";
                            bool silent = true;

                            if (root.TryGetProperty("data", out var dataProp))
                            {
                                if (dataProp.TryGetProperty("html", out var htmlProp)) html = htmlProp.GetString() ?? "";
                                if (dataProp.TryGetProperty("deviceName", out var devProp)) deviceName = devProp.GetString() ?? "";
                                if (dataProp.TryGetProperty("silent", out var silProp)) silent = silProp.GetBoolean();
                            }

                            var result = await PrintReceiptAsync(html, deviceName, silent);
                            SendIpcResponse(reqId, result);
                        }
                        break;

                    case "print-receipt-dialog":
                        {
                            string html = "";
                            if (root.TryGetProperty("data", out var dataProp))
                            {
                                if (dataProp.TryGetProperty("html", out var htmlProp)) html = htmlProp.GetString() ?? "";
                            }

                            var result = await PrintReceiptAsync(html, null, false);
                            SendIpcResponse(reqId, result);
                        }
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
                        SendIpcResponse(reqId, isFullScreen);
                        break;

                    case "toggle-fullscreen":
                        ToggleFullScreen();
                        SendIpcResponse(reqId, isFullScreen);
                        break;

                    default:
                        if (reqId > 0)
                        {
                            SendIpcResponse(reqId, (object?)null);
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebView2 Message Error] " + ex.Message);
            }
        }

        private void SendIpcResponse(int reqId, object? result)
        {
            if (reqId <= 0 || webView == null || webView.CoreWebView2 == null) return;
            try
            {
                string json = JsonSerializer.Serialize(result);
                _ = webView.CoreWebView2.ExecuteScriptAsync($"window.__onIpcResponse({reqId}, {json});");
            }
            catch { }
        }

        private List<object> GetSystemPrintersList()
        {
            var list = new List<object>();
            string defaultPrinter = "";
            try
            {
                var pd = new PrintDocument();
                defaultPrinter = pd.PrinterSettings.PrinterName ?? "";
            }
            catch { }

            try
            {
                foreach (string p in PrinterSettings.InstalledPrinters)
                {
                    bool isDef = string.Equals(p, defaultPrinter, StringComparison.OrdinalIgnoreCase);
                    list.Add(new
                    {
                        name = p,
                        displayName = p,
                        isDefault = isDef
                    });
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GetPrinters Error] " + ex.Message);
            }

            return list;
        }

        private async Task<object> PrintReceiptAsync(string html, string? targetPrinter, bool silent)
        {
            if (string.IsNullOrWhiteSpace(html))
            {
                return new { success = false, failureReason = "محتوى البون فارغ" };
            }

            // إذا كان printWebView متاحاً، نستخدمه لطباعة البون بشكل منفصل
            if (printWebView != null && printWebView.CoreWebView2 != null && webViewEnvironment != null)
            {
                try
                {
                    var tcs = new TaskCompletionSource<bool>();
                    EventHandler<CoreWebView2NavigationCompletedEventArgs>? navHandler = null;

                    navHandler = async (s, e) =>
                    {
                        printWebView.CoreWebView2.NavigationCompleted -= navHandler;
                        try
                        {
                            if (silent)
                            {
                                var printSettings = webViewEnvironment.CreatePrintSettings();
                                printSettings.ShouldPrintHeaderAndFooter = false;
                                printSettings.ShouldPrintBackgrounds = true;
                                printSettings.MarginTop = 0;
                                printSettings.MarginBottom = 0;
                                printSettings.MarginLeft = 0;
                                printSettings.MarginRight = 0;

                                if (!string.IsNullOrEmpty(targetPrinter) && targetPrinter != "DEFAULT")
                                {
                                    printSettings.PrinterName = targetPrinter;
                                }

                                var status = await printWebView.CoreWebView2.PrintAsync(printSettings);
                                if (status == CoreWebView2PrintStatus.Succeeded)
                                {
                                    tcs.TrySetResult(true);
                                    return;
                                }
                            }

                            // إذا لم تكن صامتة أو فشلت الصامتة، نفتح نافذة الطباعة
                            printWebView.CoreWebView2.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);
                            tcs.TrySetResult(true);
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[PrintAsync Error] " + ex.Message);
                            try
                            {
                                printWebView.CoreWebView2.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);
                                tcs.TrySetResult(true);
                            }
                            catch
                            {
                                tcs.TrySetResult(false);
                            }
                        }
                    };

                    printWebView.CoreWebView2.NavigationCompleted += navHandler;
                    printWebView.CoreWebView2.NavigateToString(html);

                    var completed = await Task.WhenAny(tcs.Task, Task.Delay(14000));
                    if (completed == tcs.Task && await tcs.Task)
                    {
                        return new { success = true, methodUsed = silent ? "silent" : "dialog" };
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[PrintReceipt Pipeline Error] " + ex.Message);
                }
            }

            // محاولة أخيرة عبر الـ webView الرئيسي
            try
            {
                if (webView != null && webView.CoreWebView2 != null)
                {
                    _ = webView.CoreWebView2.ExecuteScriptAsync("window.print();");
                    return new { success = true, methodUsed = "browser_fallback" };
                }
            }
            catch { }

            return new { success = false, failureReason = "تعذر تنفيذ أمر الطباعة على الطابعة" };
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

                // ج. تقديم النافذة للواجهة الحالية مؤقتاً لأخذ التركيز
                SetWindowPos(hCurrentWindow, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);

                // إذا لم يكن وضع التثبيت الدائم (Always on Top) مفعلاً بواسطة الكاشير،
                // نزيل قفل TOPMOST فوراً حتى يتمكن الكاشير من فتح أي تطبيق آخر أو التبديل بين النوافذ بحرية!
                if (!this.TopMost)
                {
                    SetWindowPos(hCurrentWindow, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                }

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
                this.FormBorderStyle = previousBorderStyle == FormBorderStyle.None ? FormBorderStyle.Sizable : previousBorderStyle;
                this.WindowState = FormWindowState.Maximized;
                isFullScreen = false;
            }
        }

        public void ToggleFullScreen()
        {
            SetFullScreen(!isFullScreen);
        }
    }
}
