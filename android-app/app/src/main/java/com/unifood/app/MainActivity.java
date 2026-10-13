package com.unifood.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.webkit.CookieManager;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final int NOTIFICATION_PERMISSION_CODE = 1002;
    private static final String CHANNEL_ID = "unifood_alerts_channel";

    private WebView webView;
    private LinearLayout loadingOverlay;
    private LinearLayout errorOverlay;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean hasLoadError = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(BuildConfig.STATUS_BAR_COLOR);

        if (BuildConfig.KEEP_SCREEN_ON) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        createNotificationChannel();

        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#F8FAFC"));

        // 1. WebView
        webView = new WebView(this);
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        rootLayout.addView(webView, webParams);

        // 2. Loading Overlay
        loadingOverlay = createLoadingOverlay();
        rootLayout.addView(loadingOverlay, webParams);

        // 3. Offline / Error Overlay
        errorOverlay = createErrorOverlay();
        errorOverlay.setVisibility(View.GONE);
        rootLayout.addView(errorOverlay, webParams);

        setContentView(rootLayout);

        configureWebView();
        webView.loadUrl(BuildConfig.START_URL);
    }

    private LinearLayout createLoadingOverlay() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);

        // خلفية أنيقة متدرجة بتناغم كامل مع ألوان وهوية التطبيق
        GradientDrawable bg = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.parseColor("#FFFFFF"), Color.parseColor("#F8FAFC")}
        );
        layout.setBackground(bg);
        layout.setPadding(dpToPx(32), dpToPx(32), dpToPx(32), dpToPx(32));

        // حاوية الشعار مع تأثير زوايا دائرية وظل أنيق
        FrameLayout iconWrapper = new FrameLayout(this);
        int iconSize = dpToPx(104);
        LinearLayout.LayoutParams iconWrapParams = new LinearLayout.LayoutParams(iconSize, iconSize);
        iconWrapParams.gravity = Gravity.CENTER_HORIZONTAL;

        GradientDrawable iconBg = new GradientDrawable();
        iconBg.setColor(Color.WHITE);
        iconBg.setCornerRadius(dpToPx(28));
        iconBg.setStroke(dpToPx(1), Color.parseColor("#E2E8F0"));
        iconWrapper.setBackground(iconBg);
        iconWrapper.setElevation(dpToPx(10));
        iconWrapper.setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_launcher);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        iconWrapper.addView(logo, logoParams);

        // حركة نبض مستمرة وحيوية للشعار (Pulse Animation)
        ScaleAnimation pulse = new ScaleAnimation(
                0.95f, 1.05f, 0.95f, 1.05f,
                Animation.RELATIVE_TO_SELF, 0.5f,
                Animation.RELATIVE_TO_SELF, 0.5f
        );
        pulse.setDuration(950);
        pulse.setRepeatMode(Animation.REVERSE);
        pulse.setRepeatCount(Animation.INFINITE);
        pulse.setInterpolator(new AccelerateDecelerateInterpolator());
        iconWrapper.startAnimation(pulse);

        layout.addView(iconWrapper, iconWrapParams);

        // اسم التطبيق UniFood
        TextView title = new TextView(this);
        title.setText("driver".equals(BuildConfig.FLAVOR_TYPE)
                ? "UniFood Driver"
                : "UniFood");
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.parseColor("#1E1B4B"));
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dpToPx(22);
        layout.addView(title, titleParams);

        // السلوجان والرسالة الترحيبية
        TextView slogan = new TextView(this);
        slogan.setText("driver".equals(BuildConfig.FLAVOR_TYPE)
                ? "بوابة كباتن توصيل الحرم الجامعي 🛵"
                : "مطاعم الحرم الجامعي بين يديك 🎓🍔");
        slogan.setTextSize(13);
        slogan.setTypeface(Typeface.DEFAULT_BOLD);
        slogan.setTextColor(Color.parseColor("#64748B"));
        slogan.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sloganParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        sloganParams.topMargin = dpToPx(8);
        layout.addView(slogan, sloganParams);

        // شريط تقدم خطي ناعم أنيق
        ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(true);
        LinearLayout.LayoutParams pbParams = new LinearLayout.LayoutParams(dpToPx(140), dpToPx(4));
        pbParams.topMargin = dpToPx(34);
        pbParams.gravity = Gravity.CENTER_HORIZONTAL;
        layout.addView(progressBar, pbParams);

        return layout;
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private LinearLayout createErrorOverlay() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#F8FAFC"));
        layout.setPadding(64, 64, 64, 64);

        TextView title = new TextView(this);
        title.setText("تعذر الاتصال بالشبكة");
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.parseColor("#0F172A"));
        title.setGravity(Gravity.CENTER);
        layout.addView(title);

        TextView desc = new TextView(this);
        desc.setText("يرجى التأكد من اتصالك بالإنترنت ثم الضغط على إعادة المحاولة.");
        desc.setTextSize(14);
        desc.setTextColor(Color.parseColor("#64748B"));
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
            loadingOverlay.setVisibility(View.VISIBLE);
            webView.reload();
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

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AndroidBridgeInterface(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String url = uri.toString();

                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:") || url.contains("wa.me/")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
                if (!hasLoadError && loadingOverlay != null && loadingOverlay.getVisibility() == View.VISIBLE) {
                    AlphaAnimation fadeOut = new AlphaAnimation(1.0f, 0.0f);
                    fadeOut.setDuration(320);
                    fadeOut.setAnimationListener(new Animation.AnimationListener() {
                        @Override
                        public void onAnimationStart(Animation animation) {}

                        @Override
                        public void onAnimationEnd(Animation animation) {
                            loadingOverlay.setVisibility(View.GONE);
                            errorOverlay.setVisibility(View.GONE);
                        }

                        @Override
                        public void onAnimationRepeat(Animation animation) {}
                    });
                    loadingOverlay.startAnimation(fadeOut);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    hasLoadError = true;
                    loadingOverlay.setVisibility(View.GONE);
                    errorOverlay.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
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
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
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

    public class AndroidBridgeInterface {
        private final Context context;

        AndroidBridgeInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getFlavor() {
            return BuildConfig.FLAVOR_TYPE;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void showNotification(String title, String body) {
            try {
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager == null) return;

                Intent intent = new Intent(context, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT;
                PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

                Notification.Builder builder;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    builder = new Notification.Builder(context, CHANNEL_ID);
                } else {
                    builder = new Notification.Builder(context)
                            .setPriority(Notification.PRIORITY_HIGH)
                            .setDefaults(Notification.DEFAULT_ALL);
                }

                builder.setSmallIcon(R.drawable.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new Notification.BigTextStyle().bigText(body))
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                int notificationId = (int) (System.currentTimeMillis() & 0xFFFFFFF);
                manager.notify(notificationId, builder.build());
            } catch (Exception ignored) {
            }
        }
    }
}
