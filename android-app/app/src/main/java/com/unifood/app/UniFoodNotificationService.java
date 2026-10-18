package com.unifood.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class UniFoodNotificationService extends Service {

    public static final String PREFS_NAME = "unifood_background_session";
    public static final String KEY_TOKEN = "session_token";
    public static final String KEY_ROLE = "session_role";
    public static final String KEY_USER_ID = "session_user_id";
    public static final String KEY_IS_ACTIVE = "session_is_active";

    public static final String CHANNEL_SERVICE = "unifood_service_channel";
    public static final String CHANNEL_ORDERS = "unifood_orders_channel";
    public static final String CHANNEL_URGENT_ALARM = "unifood_urgent_alarm_channel";
    public static final String CHANNEL_CHAT = "unifood_chat_channel";

    public static final String PREFS_HISTORY = "unifood_alerted_history";
    public static final String KEY_ALERTED_IDS = "alerted_ids_set";

    private static final int SERVICE_NOTIFICATION_ID = 9901;

    public static volatile boolean isAppInForeground = false;

    private boolean isRunning = false;
    private Thread pollingThread;
    private long lastPollTime = 0;
    private final Set<String> alertedNotificationIds = new HashSet<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Ringtone activeRingtone = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        try {
            SharedPreferences historyPrefs = getSharedPreferences(PREFS_HISTORY, MODE_PRIVATE);
            Set<String> saved = historyPrefs.getStringSet(KEY_ALERTED_IDS, null);
            if (saved != null) {
                alertedNotificationIds.addAll(saved);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isActive = prefs.getBoolean(KEY_IS_ACTIVE, false);
        String role = prefs.getString(KEY_ROLE, "");

        if (!isActive) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // تشغيل كـ Foreground Service لضمان بقاء التطبيق متصلاً في الخلفية للطيار والمطعم
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String statusText = "متصل بالخدمة في الخلفية";
            if ("DRIVER".equalsIgnoreCase(role)) {
                statusText = "🛵 كابتن التوصيل متصل بالخدمة وبانتظار الطلبات";
            } else if ("BRANCH".equalsIgnoreCase(role)) {
                statusText = "🏪 مطعمك متصل بالخدمة وبانتظار الطلبات الجديدة";
            } else if ("STUDENT".equalsIgnoreCase(role)) {
                statusText = "📦 متابعة حالة طلبك وتحديثات الكابتن الحية";
            }

            Intent openAppIntent = new Intent(this, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int pFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    : PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openAppIntent, pFlags);

            Notification.Builder builder = new Notification.Builder(this, CHANNEL_SERVICE)
                    .setContentTitle("UniFood | يونيفود")
                    .setContentText(statusText)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .setContentIntent(pendingIntent);

            startForeground(SERVICE_NOTIFICATION_ID, builder.build());
        }

        startPollingLoop();
        return START_STICKY;
    }

    private void startPollingLoop() {
        if (isRunning) return;
        isRunning = true;
        lastPollTime = System.currentTimeMillis() - (15 * 1000); // آخر 15 ثانية

        pollingThread = new Thread(() -> {
            while (isRunning) {
                try {
                    pollServerNotifications();
                } catch (Exception ignored) {
                }

                try {
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                    String role = prefs.getString(KEY_ROLE, "");
                    // الطيار والمطعم: فحص كل 6 ثوانٍ لسرعة رنين الأوردر، الطالب: كل 10 ثوانٍ
                    long sleepMs = ("DRIVER".equalsIgnoreCase(role) || "BRANCH".equalsIgnoreCase(role)) ? 6000 : 10000;
                    Thread.sleep(sleepMs);
                } catch (InterruptedException e) {
                    break;
                }
            }
        });
        pollingThread.start();
    }

    private String getBaseServerUrl() {
        try {
            SharedPreferences remotePrefs = getSharedPreferences("unifood_remote_config", MODE_PRIVATE);
            String savedBase = remotePrefs.getString("cached_base_url", null);
            if (savedBase != null && (savedBase.startsWith("https://") || savedBase.startsWith("http://"))) {
                return savedBase.replaceAll("/+$", "");
            }
        } catch (Exception ignored) {
        }
        return BuildConfig.BASE_URL.replaceAll("/+$", "");
    }

    private void pollServerNotifications() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, "");
        String role = prefs.getString(KEY_ROLE, "");
        String userId = prefs.getString(KEY_USER_ID, "");

        if (token.isEmpty() && userId.isEmpty()) return;

        HttpURLConnection conn = null;
        try {
            String baseUrl = getBaseServerUrl();
            String pollUrl = baseUrl + "/api/notifications/poll?role=" + role + "&userId=" + userId + "&since=" + lastPollTime;

            URL url = new URL(pollUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4500);
            conn.setReadTimeout(4500);
            conn.setUseCaches(false);
            if (!token.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }
            conn.setRequestProperty("User-Agent", "UniFood-BackgroundService");

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                }

                JSONObject res = new JSONObject(sb.toString());
                if (res.optBoolean("success", false)) {
                    long serverTime = res.optLong("serverTime", System.currentTimeMillis());
                    JSONArray list = res.optJSONArray("notifications");
                    if (list != null && list.length() > 0) {
                        for (int i = 0; i < list.length(); i++) {
                            JSONObject item = list.getJSONObject(i);
                            handleNotificationItem(item);
                        }
                    }
                    lastPollTime = Math.max(lastPollTime, serverTime);
                }
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
    }

    private synchronized boolean isNotificationAlreadyAlerted(String id) {
        if (id == null || id.isEmpty()) return false;
        if (alertedNotificationIds.contains(id)) {
            return true;
        }
        try {
            SharedPreferences historyPrefs = getSharedPreferences(PREFS_HISTORY, MODE_PRIVATE);
            Set<String> saved = historyPrefs.getStringSet(KEY_ALERTED_IDS, null);
            if (saved != null && saved.contains(id)) {
                alertedNotificationIds.add(id);
                return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private synchronized void markNotificationAlerted(String id) {
        if (id == null || id.isEmpty()) return;
        alertedNotificationIds.add(id);
        if (alertedNotificationIds.size() > 300) {
            Set<String> trimmed = new HashSet<>();
            int count = 0;
            for (String s : alertedNotificationIds) {
                trimmed.add(s);
                if (++count >= 150) break;
            }
            alertedNotificationIds.clear();
            alertedNotificationIds.addAll(trimmed);
        }
        try {
            SharedPreferences historyPrefs = getSharedPreferences(PREFS_HISTORY, MODE_PRIVATE);
            Set<String> saved = historyPrefs.getStringSet(KEY_ALERTED_IDS, new HashSet<>());
            Set<String> updated = new HashSet<>(saved);
            updated.add(id);
            if (updated.size() > 300) {
                Set<String> trimmed = new HashSet<>();
                int count = 0;
                for (String s : updated) {
                    trimmed.add(s);
                    if (++count >= 150) break;
                }
                updated = trimmed;
            }
            historyPrefs.edit().putStringSet(KEY_ALERTED_IDS, updated).apply();
        } catch (Exception ignored) {
        }
    }

    private void handleNotificationItem(JSONObject item) {
        try {
            String id = item.optString("id", "");
            if (id.isEmpty()) return;

            // إذا كان التطبيق مفتوحاً وشغالاً أمام المستخدم في الواجهة، نتجنب إظهار إشعارات أو رنين في شريط النظام
            // لأن واجهة التطبيق تتولى التحديث اللحظي وتشغيل صوت التنبيه المخصص بدون أي تضارب
            if (isAppInForeground) {
                // تسجيل المعرف حتى لا يرن النظام لاحقاً لنفس الحدث إذا أغلق المستخدم التطبيق
                markNotificationAlerted(id);
                return;
            }

            // فحص هل تم تنبيه المستخدم بهذا الإشعار مسبقاً لمنع التكرار والإزعاج نهائياً
            if (isNotificationAlreadyAlerted(id)) {
                return;
            }
            markNotificationAlerted(id);

            String channel = item.optString("channel", "ORDERS");

            String tag = item.optString("tag", "order_default");
            String title = item.optString("title", "تحديث جديد");
            String body = item.optString("body", "");
            String subText = item.optString("subText", "UniFood");
            String colorHex = item.optString("color", "#4F46E5");
            String soundType = item.optString("soundType", "DEFAULT");
            String actionUrl = item.optString("actionUrl", "/");

            String targetChannelId = CHANNEL_ORDERS;
            if ("URGENT_ALARM".equalsIgnoreCase(channel)) {
                targetChannelId = CHANNEL_URGENT_ALARM;
            } else if ("CHAT".equalsIgnoreCase(channel)) {
                targetChannelId = CHANNEL_CHAT;
            }

            // PendingIntent لفتح التطبيق والانتقال للشاشة المطلوبة فوراً عند الضغط
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("target_url", actionUrl);

            int pFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    : PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent pendingIntent = PendingIntent.getActivity(this, tag.hashCode(), intent, pFlags);

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, targetChannelId);
            } else {
                builder = new Notification.Builder(this)
                        .setPriority(Notification.PRIORITY_HIGH)
                        .setDefaults(Notification.DEFAULT_ALL);
            }

            int accentColor = Color.parseColor("#4F46E5");
            try {
                if (colorHex != null && colorHex.startsWith("#")) {
                    accentColor = Color.parseColor(colorHex);
                }
            } catch (Exception ignored) {
            }

            builder.setContentTitle(title)
                    .setContentText(body)
                    .setSubText(subText)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setColor(accentColor)
                    .setStyle(new Notification.BigTextStyle().bigText(body).setSummaryText(subText))
                    .setOnlyAlertOnce(true)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                builder.setVisibility(Notification.VISIBILITY_PUBLIC);
            }

            // استخدام نفس الـ tag ورقم ID ثابت لنفس الطلب لتحديث كارت الإشعار تلقائياً بدون زحمة
            int notifId = Math.abs(tag.hashCode());
            manager.notify(tag, notifId, builder.build());

            // إطلاق التنبيه الصوتي المناسب (فقط إذا لم يكن نظام أندرويد 8+ يتكفل به عبر القناة)
            triggerAlert(soundType);
        } catch (Exception ignored) {
        }
    }

    private void triggerAlert(String soundType) {
        // على أندرويد 8+ (Oreo أو أحدث) تتكفل قنوات NotificationChannel بالرنين الصوتي النظيف والاهتزاز تلقائياً
        // نشغل الرنين اليدوي فقط إذا كان إنذاراً طارئاً ALARM (مثل طلب جديد وارد للطيار أو المطعم)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !"ALARM".equalsIgnoreCase(soundType)) {
            return;
        }

        mainHandler.post(() -> {
            try {
                // 1. الاهتزاز
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if ("ALARM".equalsIgnoreCase(soundType)) {
                        long[] pattern = {0, 450, 150, 450, 150, 600};
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                        } else {
                            v.vibrate(pattern, -1);
                        }
                    } else {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            v.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE));
                        } else {
                            v.vibrate(300);
                        }
                    }
                }

                // 2. الرنين الصوتي
                Uri soundUri = RingtoneManager.getDefaultUri(
                        "ALARM".equalsIgnoreCase(soundType)
                                ? RingtoneManager.TYPE_ALARM
                                : RingtoneManager.TYPE_NOTIFICATION
                );
                if (soundUri == null) {
                    soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }

                if (soundUri != null) {
                    if (activeRingtone != null && activeRingtone.isPlaying()) {
                        activeRingtone.stop();
                    }
                    activeRingtone = RingtoneManager.getRingtone(getApplicationContext(), soundUri);
                    if (activeRingtone != null) {
                        activeRingtone.play();
                        // إيقاف نغمة الإنذار بعد 4.5 ثوانٍ تلقائياً لعدم الإزعاج
                        mainHandler.postDelayed(() -> {
                            if (activeRingtone != null && activeRingtone.isPlaying()) {
                                activeRingtone.stop();
                            }
                        }, 4500);
                    }
                }
            } catch (Exception ignored) {
            }
        });
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // 1. قناة الخدمة في الخلفية (صامتة وهادئة)
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_SERVICE,
                    "اتصال الخدمة في الخلفية",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("الحفاظ على اتصال التطبيق بالخلفية للطلبات المباشرة");
            serviceChannel.setShowBadge(false);
            manager.createNotificationChannel(serviceChannel);

            // 2. قناة تتبع الطلبات
            NotificationChannel ordersChannel = new NotificationChannel(
                    CHANNEL_ORDERS,
                    "إشعارات الطلبات والتوصيل",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ordersChannel.setDescription("تحديثات حالات الطلب والاستلام");
            ordersChannel.enableVibration(true);
            ordersChannel.setShowBadge(true);
            manager.createNotificationChannel(ordersChannel);

            // 3. قناة إنذار الطلبات الطارئة (للطيار والمطعم)
            NotificationChannel urgentChannel = new NotificationChannel(
                    CHANNEL_URGENT_ALARM,
                    "تنبيهات الطلبات الطارئة (كابتن / مطعم)",
                    NotificationManager.IMPORTANCE_HIGH
            );
            urgentChannel.setDescription("إنذار صوتي فوري عند إسناد أو وصول طلب جديد");
            urgentChannel.enableVibration(true);
            urgentChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build();
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri != null) {
                urgentChannel.setSound(alarmUri, audioAttributes);
            }
            manager.createNotificationChannel(urgentChannel);

            // 4. قناة الرسائل والمحادثة السريعة
            NotificationChannel chatChannel = new NotificationChannel(
                    CHANNEL_CHAT,
                    "رسائل المحادثة السريعة مع الكابتن",
                    NotificationManager.IMPORTANCE_HIGH
            );
            chatChannel.setDescription("رسائل سريعة بين الطالب وكابتن التوصيل");
            chatChannel.enableVibration(true);
            manager.createNotificationChannel(chatChannel);
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (pollingThread != null) {
            pollingThread.interrupt();
        }
        if (activeRingtone != null && activeRingtone.isPlaying()) {
            activeRingtone.stop();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
