package com.unifood.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final int NOTIFICATION_PERMISSION_CODE = 1002;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1003;
    private static final String CHANNEL_ID = "unifood_alerts_channel";
    private static final String PREFS_NAME = "unifood_remote_config";
    private static final String KEY_CACHED_START_URL = "cached_start_url_" + BuildConfig.FLAVOR_TYPE;
    private static final String KEY_CACHED_BASE_URL = "cached_base_url";

    private WebView webView;
    private LinearLayout errorOverlay;
    private ValueCallback<Uri[]> filePathCallback;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private boolean hasLoadError = false;
    private volatile String activeStartUrl = BuildConfig.START_URL;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private String getActiveStartUrl() {
        return (activeStartUrl != null && !activeStartUrl.trim().isEmpty())
                ? activeStartUrl
                : BuildConfig.START_URL;
    }

    private String getActiveHost() {
        try {
            String host = Uri.parse(getActiveStartUrl()).getHost();
            if (host != null && !host.isEmpty()) return host;
        } catch (Exception ignored) {
        }
        try {
            return Uri.parse(BuildConfig.START_URL).getHost();
        } catch (Exception ignored) {
            return null;
        }
    }

    private void loadCachedRemoteConfig() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String savedStartUrl = prefs.getString(KEY_CACHED_START_URL, null);
            if (savedStartUrl != null && (savedStartUrl.startsWith("https://") || savedStartUrl.startsWith("http://"))) {
                activeStartUrl = savedStartUrl;
            } else {
                activeStartUrl = BuildConfig.START_URL;
            }
        } catch (Exception ignored) {
            activeStartUrl = BuildConfig.START_URL;
        }
    }

    private String fetchJsonText(String endpointUrl, boolean isGitHubApi) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpointUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(2500);
            conn.setUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
            conn.setRequestProperty("Pragma", "no-cache");
            conn.setRequestProperty("User-Agent", "UniFood-Android-App");
            if (isGitHubApi) {
                conn.setRequestProperty("Accept", "application/vnd.github.raw");
            }
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append('\n');
                    }
                }
                return sb.toString().trim();
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                try {
                    conn.disconnect();
                } catch (Exception ignored) {
                }
            }
        }
        return null;
    }

    private String resolveFlavorStartUrlFromConfig(JSONObject json) {
        if (json == null) return null;
        String flavor = BuildConfig.FLAVOR_TYPE; // "student", "driver", "admin", "restaurant"

        // 1. Check if a direct full URL for this flavor is specified (e.g. "studentUrl")
        String directUrl = json.optString(flavor + "Url", "").trim();
        if (directUrl.startsWith("https://") || directUrl.startsWith("http://")) {
            return directUrl;
        }

        // 2. Otherwise use "baseUrl" + flavor path
        String baseUrl = json.optString("baseUrl", "").trim();
        if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://")) {
            return null;
        }
        baseUrl = baseUrl.replaceAll("/+$", "");

        String customPath = json.optString(flavor + "Path", "").trim();
        String path = !customPath.isEmpty() ? customPath : BuildConfig.FLAVOR_PATH;
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return baseUrl + path;
    }

    private void syncRemoteConfigFromGitHub(Runnable onResolvedCallback, boolean reloadIfChanged) {
        new Thread(() -> {
            String resolvedUrl = null;
            String resolvedBase = null;
            try {
                // المحاولة الأولى: عبر GitHub API مباشرة لتجنب أي تأخير في الكاش (0-second delay)
                String rawJson = fetchJsonText(BuildConfig.REMOTE_CONFIG_API_URL + "&_t=" + System.currentTimeMillis(), true);
                if (rawJson == null || rawJson.isEmpty()) {
                    // المحاولة الاحتياطية: عبر رابط raw.githubusercontent.com
                    rawJson = fetchJsonText(BuildConfig.REMOTE_CONFIG_URL + "?t=" + System.currentTimeMillis(), false);
                }

                if (rawJson != null && !rawJson.isEmpty()) {
                    JSONObject json = new JSONObject(rawJson);
                    resolvedUrl = resolveFlavorStartUrlFromConfig(json);
                    resolvedBase = json.optString("baseUrl", "").trim().replaceAll("/+$", "");
                }
            } catch (Exception ignored) {
            }

            final String finalResolvedUrl = resolvedUrl;
            final String finalResolvedBase = resolvedBase;

            mainHandler.post(() -> {
                boolean urlChanged = false;
                if (finalResolvedUrl != null && (finalResolvedUrl.startsWith("https://") || finalResolvedUrl.startsWith("http://"))) {
                    String previousUrl = getActiveStartUrl();
                    if (!finalResolvedUrl.equalsIgnoreCase(previousUrl)) {
                        urlChanged = true;
                    }
                    activeStartUrl = finalResolvedUrl;
                    try {
                        SharedPreferences.Editor editor = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit();
                        editor.putString(KEY_CACHED_START_URL, finalResolvedUrl);
                        if (finalResolvedBase != null && !finalResolvedBase.isEmpty()) {
                            editor.putString(KEY_CACHED_BASE_URL, finalResolvedBase);
                        }
                        editor.apply();
                    } catch (Exception ignored) {
                    }
                }

                if (onResolvedCallback != null) {
                    onResolvedCallback.run();
                } else if (reloadIfChanged && (urlChanged || hasLoadError) && webView != null) {
                    hasLoadError = false;
                    if (errorOverlay != null) {
                        errorOverlay.setVisibility(View.GONE);
                    }
                    webView.loadUrl(getActiveStartUrl());
                }
            });
        }).start();
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        loadCachedRemoteConfig();

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(BuildConfig.STATUS_BAR_COLOR);

        if (BuildConfig.KEEP_SCREEN_ON) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        createNotificationChannel();
        requestNotificationPermissionIfNeeded();

        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#0B0F19"));

        // 1. WebView (loads the app directly so React Splash Screen displays immediately)
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0B0F19"));
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        rootLayout.addView(webView, webParams);

        // 2. Offline / Error Overlay
        errorOverlay = createErrorOverlay();
        errorOverlay.setVisibility(View.GONE);
        rootLayout.addView(errorOverlay, webParams);

        setContentView(rootLayout);

        configureWebView();

        // التحقق السريع من ملف الدومين على GitHub (بحد أقصى 1.2 ثانية قبل الفتح، أو التبديل التلقائي فور وصوله)
        final AtomicBoolean initialLoadTriggered = new AtomicBoolean(false);
        final String initialCachedUrl = getActiveStartUrl();

        Runnable fallbackStarter = () -> {
            if (initialLoadTriggered.compareAndSet(false, true)) {
                webView.loadUrl(getActiveStartUrl());
            }
        };

        mainHandler.postDelayed(fallbackStarter, 1200);

        syncRemoteConfigFromGitHub(() -> {
            mainHandler.removeCallbacks(fallbackStarter);
            if (initialLoadTriggered.compareAndSet(false, true)) {
                webView.loadUrl(getActiveStartUrl());
            } else if (!getActiveStartUrl().equalsIgnoreCase(initialCachedUrl)) {
                // إذا كان قد بدأ تحميل الرابط القديم ثم وصل دومين جديد من GitHub، ينتقل فوراً للدومين الجديد
                hasLoadError = false;
                if (errorOverlay != null) {
                    errorOverlay.setVisibility(View.GONE);
                }
                webView.loadUrl(getActiveStartUrl());
            }
        }, true);
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private LinearLayout createErrorOverlay() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#0B0F19"));
        layout.setPadding(64, 64, 64, 64);

        TextView title = new TextView(this);
        title.setText("تعذر الاتصال بالشبكة");
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);

        TextView desc = new TextView(this);
        desc.setText("يرجى التأكد من اتصالك بالإنترنت ثم الضغط على إعادة المحاولة.");
        desc.setTextSize(14);
        desc.setTextColor(Color.parseColor("#94A3B8"));
        desc.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        descParams.topMargin = 20;
        descParams.bottomMargin = 48;
        layout.addView(desc, descParams);

        Button retryBtn = new Button(this);
        retryBtn.setText("إعادة المحاولة الآن");
        retryBtn.setTextColor(Color.WHITE);
        retryBtn.setTextSize(14);
        retryBtn.setTypeface(Typeface.DEFAULT_BOLD);
        retryBtn.setPadding(64, 28, 64, 28);

        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(BuildConfig.STATUS_BAR_COLOR);
        btnBg.setCornerRadius(32f);
        retryBtn.setBackground(btnBg);

        retryBtn.setOnClickListener(v -> {
            hasLoadError = false;
            errorOverlay.setVisibility(View.GONE);
            // عند الضغط على إعادة المحاولة، نقرأ أحدث دومين من GitHub أولاً ثم نعيد التحميل
            syncRemoteConfigFromGitHub(() -> {
                String currentUrl = webView.getUrl();
                try {
                    String startHost = getActiveHost();
                    if (currentUrl != null && startHost != null && currentUrl.contains(startHost)) {
                        webView.reload();
                    } else {
                        webView.loadUrl(getActiveStartUrl());
                    }
                } catch (Exception e) {
                    webView.loadUrl(getActiveStartUrl());
                }
            }, true);
        });

        layout.addView(retryBtn, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        return layout;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setGeolocationEnabled(true);
        try {
            settings.setGeolocationDatabasePath(getFilesDir().getPath());
        } catch (Exception ignored) {
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AndroidBridgeInterface(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String url = uri.toString();

                // 1. Handle intent:// schemes safely (restrict to BROWSABLE activities only)
                if (url.startsWith("intent://")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        if (intent != null) {
                            intent.addCategory(Intent.CATEGORY_BROWSABLE);
                            intent.setComponent(null);
                            intent.setSelector(null);
                            if (getPackageManager().resolveActivity(intent, 0) != null) {
                                startActivity(intent);
                                return true;
                            }
                            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                            if (fallbackUrl != null && (fallbackUrl.startsWith("https://") || fallbackUrl.startsWith("http://"))) {
                                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl));
                                startActivity(browserIntent);
                                return true;
                            }
                        }
                    } catch (Exception ignored) {
                    }
                    return true;
                }

                // 2. Handle maps, geo, phone, email, messaging
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:") ||
                    url.contains("wa.me/") || url.startsWith("geo:") || url.contains("maps.google.") ||
                    url.contains("google.com/maps") || url.contains("maps.app.goo.gl")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                    return true;
                }

                // 3. Any external host (target="_blank" or external link that doesn't match active host)
                try {
                    String startHost = getActiveHost();
                    String reqHost = uri.getHost();
                    if (reqHost != null && startHost != null && !reqHost.equalsIgnoreCase(startHost)) {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    }
                } catch (Exception ignored) {
                }

                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
                if (!hasLoadError && errorOverlay != null && errorOverlay.getVisibility() == View.VISIBLE) {
                    errorOverlay.setVisibility(View.GONE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    hasLoadError = true;
                    errorOverlay.setVisibility(View.VISIBLE);
                    // إذا فشل الاتصال بالدومين الحالي، نتحقق تلقائياً من GitHub في حال تم تغيير الدومين
                    syncRemoteConfigFromGitHub(null, true);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                try {
                    String startHost = getActiveHost();
                    String originHost = Uri.parse(origin).getHost();
                    if (startHost != null && originHost != null && !originHost.equalsIgnoreCase(startHost)) {
                        callback.invoke(origin, false, false);
                        return;
                    }
                } catch (Exception ignored) {
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                        callback.invoke(origin, true, false);
                    } else {
                        pendingGeoCallback = callback;
                        pendingGeoOrigin = origin;
                        requestPermissions(new String[]{
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }, LOCATION_PERMISSION_REQUEST_CODE);
                    }
                } else {
                    callback.invoke(origin, true, false);
                }
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                try {
                    Intent intent = fileChooserParams.createIntent();
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(url));
                startActivity(intent);
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        UniFoodNotificationService.isAppInForeground = true;
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
        // عند عودة المستخدم للتطبيق من الخلفية، نتحقق في الخلفية إذا تغير الدومين على GitHub
        syncRemoteConfigFromGitHub(null, true);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.hasExtra("target_url")) {
            String targetUrl = intent.getStringExtra("target_url");
            if (targetUrl != null && !targetUrl.trim().isEmpty() && webView != null) {
                String trimmed = targetUrl.trim();
                // حماية من إعادة التوجيه الضار: مسار نسبي يبدأ بـ / واحدة (وليس //) أو نطاق موثوق معتمد
                if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
                    String base = getActiveStartUrl().replaceAll("/+$", "");
                    webView.loadUrl(base + trimmed);
                } else if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
                    try {
                        Uri parsed = Uri.parse(trimmed);
                        String host = parsed.getHost();
                        String activeHost = getActiveHost();
                        boolean isTrustedHost = host != null && (
                            host.equalsIgnoreCase("unifood.store") ||
                            host.endsWith(".unifood.store") ||
                            (activeHost != null && host.equalsIgnoreCase(activeHost)) ||
                            host.equalsIgnoreCase("localhost") ||
                            host.equals("127.0.0.1") ||
                            host.equals("10.0.2.2")
                        );
                        if (isTrustedHost) {
                            webView.loadUrl(trimmed);
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        UniFoodNotificationService.isAppInForeground = false;
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        UniFoodNotificationService.isAppInForeground = false;
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "إشعارات الطلبات والتوصيل",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("تنبيهات فورية لحالة الطلبات وكباتن التوصيل");
            channel.enableVibration(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            }
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        } else {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        }
    }

    public class AndroidBridgeInterface {
        private final Context context;

        AndroidBridgeInterface(Context context) {
            this.context = context;
        }

        private boolean isCallerOriginTrusted() {
            if (webView == null) return false;
            String currentUrl = webView.getUrl();
            if (currentUrl == null) return false;
            try {
                Uri parsed = Uri.parse(currentUrl);
                String host = parsed.getHost();
                if (host == null) return false;
                String activeHost = getActiveHost();
                return host.equalsIgnoreCase("unifood.store") ||
                       host.endsWith(".unifood.store") ||
                       (activeHost != null && host.equalsIgnoreCase(activeHost)) ||
                       host.equalsIgnoreCase("localhost") ||
                       host.equals("127.0.0.1") ||
                       host.equals("10.0.2.2");
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getFlavor() {
            return BuildConfig.FLAVOR_TYPE;
        }

        @JavascriptInterface
        public String getServerUrl() {
            return getActiveStartUrl();
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void registerBackgroundSession(String token, String role, String userId) {
            if (!isCallerOriginTrusted()) return;
            try {
                SharedPreferences.Editor editor = context.getSharedPreferences(UniFoodNotificationService.PREFS_NAME, Context.MODE_PRIVATE).edit();
                editor.putString(UniFoodNotificationService.KEY_TOKEN, token != null ? token.trim() : "");
                editor.putString(UniFoodNotificationService.KEY_ROLE, role != null ? role.trim().toUpperCase() : "");
                editor.putString(UniFoodNotificationService.KEY_USER_ID, userId != null ? userId.trim() : "");
                editor.putBoolean(UniFoodNotificationService.KEY_IS_ACTIVE, true);
                editor.apply();

                Intent serviceIntent = new Intent(context, UniFoodNotificationService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void clearBackgroundSession() {
            if (!isCallerOriginTrusted()) return;
            try {
                SharedPreferences.Editor editor = context.getSharedPreferences(UniFoodNotificationService.PREFS_NAME, Context.MODE_PRIVATE).edit();
                editor.putBoolean(UniFoodNotificationService.KEY_IS_ACTIVE, false);
                editor.remove(UniFoodNotificationService.KEY_TOKEN);
                editor.remove(UniFoodNotificationService.KEY_USER_ID);
                editor.apply();

                Intent serviceIntent = new Intent(context, UniFoodNotificationService.class);
                context.stopService(serviceIntent);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void showNotification(String title, String body) {
            showNotificationWithTag(title, body, null);
        }

        @JavascriptInterface
        public void showNotificationWithTag(String title, String body, String tag) {
            if (!isCallerOriginTrusted()) return;
            try {
                if (UniFoodNotificationService.isAppInForeground) {
                    return;
                }
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager == null) return;

                String safeTag = tag;
                if (safeTag == null || safeTag.trim().isEmpty()) {
                    if (title != null && title.contains("#")) {
                        int hashIdx = title.indexOf("#");
                        int endIdx = hashIdx + 1;
                        while (endIdx < title.length() && Character.isDigit(title.charAt(endIdx))) {
                            endIdx++;
                        }
                        if (endIdx > hashIdx + 1) {
                            safeTag = "order_" + title.substring(hashIdx + 1, endIdx);
                        }
                    }
                }
                if (safeTag == null || safeTag.trim().isEmpty()) {
                    safeTag = "unifood_alert";
                }

                Intent intent = new Intent(context, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT;
                PendingIntent pendingIntent = PendingIntent.getActivity(context, Math.abs(safeTag.hashCode()), intent, flags);

                Notification.Builder builder;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    builder = new Notification.Builder(context, CHANNEL_ID);
                } else {
                    builder = new Notification.Builder(context)
                            .setPriority(Notification.PRIORITY_HIGH)
                            .setDefaults(Notification.DEFAULT_ALL);
                }

                builder.setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new Notification.BigTextStyle().bigText(body))
                        .setOnlyAlertOnce(true)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                int notificationId = Math.abs(safeTag.hashCode());
                manager.notify(safeTag, notificationId, builder.build());
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void downloadFile(String filename, String content, String mimeType) {
            if (!isCallerOriginTrusted()) return;
            try {
                String safeFilename = new File(filename != null ? filename : "report.csv")
                        .getName()
                        .replaceAll("[\\\\/:*?\"<>|]", "_");
                if (safeFilename.isEmpty() || safeFilename.startsWith(".")) {
                    safeFilename = "report_" + System.currentTimeMillis() + ".csv";
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeFilename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType != null ? mimeType : "text/csv");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(content.getBytes(StandardCharsets.UTF_8));
                                os.flush();
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) downloadsDir.mkdirs();
                    File file = new File(downloadsDir, safeFilename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }
                }

                showNotification("تم تحميل التقرير بنجاح 📁", "تم حفظ " + safeFilename + " في مجلد التنزيلات (Downloads)");
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            if (!isCallerOriginTrusted()) return;
            try {
                if (url == null || url.trim().isEmpty()) return;
                Uri uri = Uri.parse(url.trim());
                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
                if (!scheme.equals("http") && !scheme.equals("https") && !scheme.equals("tel") &&
                    !scheme.equals("mailto") && !scheme.equals("whatsapp") && !scheme.equals("geo")) {
                    return;
                }
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setComponent(null);
                intent.setSelector(null);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception ignored) {
            }
        }
    }
}
