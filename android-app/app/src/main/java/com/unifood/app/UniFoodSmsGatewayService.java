package com.unifood.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class UniFoodSmsGatewayService extends Service {

    private static final String TAG = "UniFoodSmsGateway";
    public static final String PREFS_NAME = "unifood_sms_gateway_prefs";
    public static final String KEY_SERVER_URL = "gateway_server_url";
    public static final String KEY_DEVICE_KEY = "gateway_device_key";
    public static final String KEY_SERVICE_ENABLED = "gateway_service_enabled";
    public static final String KEY_SENT_COUNT = "gateway_sent_count_today";
    public static final String KEY_SELECTED_SIM_ID = "gateway_selected_sim_id";

    private static final String CHANNEL_ID = "unifood_sms_gateway_channel";
    private static final int NOTIFICATION_ID = 9902;

    public static volatile boolean isServiceRunning = false;

    private PowerManager.WakeLock wakeLock;
    private Thread workerThread;
    private boolean isRunning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void startGatewayService(Context context, String serverUrl, String deviceKey) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_SERVER_URL, serverUrl.replaceAll("/+$", ""))
                .putString(KEY_DEVICE_KEY, deviceKey.trim())
                .putBoolean(KEY_SERVICE_ENABLED, true)
                .apply();

        Intent intent = new Intent(context, UniFoodSmsGatewayService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopGatewayService(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_SERVICE_ENABLED, false).apply();

        Intent intent = new Intent(context, UniFoodSmsGatewayService.class);
        context.stopService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildForegroundNotification("خدمة إرسال رسائل SMS تعمل بنجاح"));

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "UniFood:SmsGatewayWakeLock");
            wakeLock.acquire(24 * 60 * 60 * 1000L); // أقصى مدة 24 ساعة ثم تجدد
        }

        isRunning = true;
        isServiceRunning = true;

        if (workerThread == null || !workerThread.isAlive()) {
            workerThread = new Thread(this::runWorkerLoop, "SmsGatewayWorker");
            workerThread.start();
        }

        return START_STICKY;
    }

    private void runWorkerLoop() {
        Log.i(TAG, "SMS Gateway worker loop started.");

        while (isRunning) {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String serverUrl = prefs.getString(KEY_SERVER_URL, BuildConfig.BASE_URL);
                String deviceKey = prefs.getString(KEY_DEVICE_KEY, "UNIFOOD-SMS-GATEWAY-2026");
                boolean enabled = prefs.getBoolean(KEY_SERVICE_ENABLED, true);

                if (!enabled) {
                    Log.i(TAG, "SMS Gateway disabled in prefs. Stopping.");
                    break;
                }

                // 1. تجميع بيانات حالة الهاتف (Battery & SIM)
                int batteryLevel = getBatteryPercentage();
                boolean isCharging = isBatteryCharging();
                String simOperator = getSimOperatorName();

                // 2. إرسال النبضة وجلب الرسائل المعلقة
                JSONArray pendingMessages = sendHeartbeat(serverUrl, deviceKey, batteryLevel, isCharging, simOperator);

                if (pendingMessages != null && pendingMessages.length() > 0) {
                    Log.i(TAG, "Found " + pendingMessages.length() + " pending SMS messages. Dispatching...");

                    for (int i = 0; i < pendingMessages.length(); i++) {
                        JSONObject msgObj = pendingMessages.getJSONObject(i);
                        String logId = msgObj.optString("id");
                        String phone = msgObj.optString("phone");
                        String message = msgObj.optString("message");

                        if (!phone.isEmpty() && !message.isEmpty()) {
                            SendResult result = sendSmsViaSim(phone, message);
                            reportMessageStatus(serverUrl, deviceKey, logId, result.success ? "SENT" : "FAILED", result.errorReason);

                            if (result.success) {
                                int count = prefs.getInt(KEY_SENT_COUNT, 0) + 1;
                                prefs.edit().putInt(KEY_SENT_COUNT, count).apply();
                                updateNotificationText("تم إرسال " + count + " رسالة بنجاح اليوم");
                            }

                            // مهلة أمان قصيرة بين الرسائل لتجنب فلاتر السبام
                            Thread.sleep(1500);
                        }
                    }
                }

            } catch (InterruptedException e) {
                Log.w(TAG, "Worker loop interrupted.");
                break;
            } catch (Exception e) {
                Log.e(TAG, "Error in SMS Gateway loop: " + e.getMessage());
            }

            // تكرار الفحص والنبضة كل 8 إلى 10 ثوانٍ
            try {
                Thread.sleep(8000);
            } catch (InterruptedException e) {
                break;
            }
        }

        isServiceRunning = false;
        Log.i(TAG, "SMS Gateway worker loop finished.");
    }

    public static class SendResult {
        public final boolean success;
        public final String errorReason;

        public SendResult(boolean success, String errorReason) {
            this.success = success;
            this.errorReason = errorReason;
        }
    }

    /**
     * إرسال رسالة SMS عبر دالة الأندرويد الرسمية SmsManager مع دعم الشرائح المتعددة والتحقق من الصلاحيات
     */
    public SendResult sendSmsViaSim(String phone, String message) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.SEND_SMS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "SEND_SMS permission not granted");
                return new SendResult(false, "صلاحية إرسال الرسائل (SEND_SMS) غير مفعّلة في الهاتف");
            }
        }

        SmsManager smsManager = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                int selectedSubId = prefs.getInt(KEY_SELECTED_SIM_ID, -1);
                int targetSubId = selectedSubId != -1 ? selectedSubId : SubscriptionManager.getDefaultSmsSubscriptionId();

                if (targetSubId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        smsManager = getSystemService(SmsManager.class).createForSubscriptionId(targetSubId);
                    } else {
                        smsManager = SmsManager.getSmsManagerForSubscriptionId(targetSubId);
                    }
                    Log.i(TAG, "Using target SIM subscriptionId: " + targetSubId + (selectedSubId != -1 ? " (User Selected)" : " (System Default)"));
                } else {
                    SubscriptionManager subManager = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                    if (subManager != null) {
                        List<SubscriptionInfo> activeSubs = subManager.getActiveSubscriptionInfoList();
                        if (activeSubs != null && !activeSubs.isEmpty()) {
                            int activeSubId = activeSubs.get(0).getSubscriptionId();
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                smsManager = getSystemService(SmsManager.class).createForSubscriptionId(activeSubId);
                            } else {
                                smsManager = SmsManager.getSmsManagerForSubscriptionId(activeSubId);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Subscription resolution notice: " + e.getMessage());
        }

        if (smsManager == null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getSystemService(SmsManager.class);
            }
            if (smsManager == null) {
                smsManager = SmsManager.getDefault();
            }
        }

        if (smsManager == null) {
            Log.e(TAG, "SmsManager is null. Cannot send SMS.");
            return new SendResult(false, "تعذر تهيئة نظام إرسال الرسائل في الهاتف");
        }

        String targetPhone = phone.trim().replaceAll("[^0-9+]", "");
        try {
            ArrayList<String> parts = smsManager.divideMessage(message);
            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(targetPhone, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(targetPhone, null, message, null, null);
            }

            Log.i(TAG, "SMS dispatched successfully to: " + targetPhone);
            return new SendResult(true, null);
        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException: " + se.getMessage());
            return new SendResult(false, "صلاحية إرسال الرسائل (SEND_SMS) مرفوضة من الهاتف");
        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS to " + targetPhone + ": " + e.getMessage());

            // If target starts with 01 (11 digits), retry with +20 prefix as international format
            if (targetPhone.startsWith("01") && targetPhone.length() == 11) {
                try {
                    String intlPhone = "+20" + targetPhone.substring(1);
                    ArrayList<String> parts = smsManager.divideMessage(message);
                    if (parts.size() > 1) {
                        smsManager.sendMultipartTextMessage(intlPhone, null, parts, null, null);
                    } else {
                        smsManager.sendTextMessage(intlPhone, null, message, null, null);
                    }
                    Log.i(TAG, "SMS (+20 fallback) sent successfully to: " + intlPhone);
                    return new SendResult(true, null);
                } catch (Exception ex2) {
                    return new SendResult(false, "فشل الإرسال: " + ex2.getMessage());
                }
            }
            return new SendResult(false, "فشل الإرسال: " + e.getMessage());
        }
    }

    /**
     * إرسال نبضة للسيرفر وجلب أي رسائل معلقة
     */
    private JSONArray sendHeartbeat(String serverUrl, String deviceKey, int batteryLevel, boolean isCharging, String simOperator) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(serverUrl + "/api/sms-gateway/device/heartbeat");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("x-gateway-key", deviceKey);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("batteryLevel", batteryLevel);
            body.put("isCharging", isCharging);
            body.put("simOperator", simOperator);
            body.put("appVersion", "1.2.0");

            byte[] outputBytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(outputBytes);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line);
                    }
                    JSONObject resJson = new JSONObject(response.toString());
                    return resJson.optJSONArray("pendingMessages");
                }
            } else {
                Log.w(TAG, "Heartbeat failed with code: " + responseCode);
            }
        } catch (Exception e) {
            Log.w(TAG, "Heartbeat connection error: " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    /**
     * إبلاغ السيرفر بنتيجة إرسال الرسالة
     */
    private void reportMessageStatus(String serverUrl, String deviceKey, String logId, String status, String errorReason) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(serverUrl + "/api/sms-gateway/device/report");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("x-gateway-key", deviceKey);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("logId", logId);
            body.put("status", status);
            if (errorReason != null) body.put("errorReason", errorReason);

            byte[] outputBytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(outputBytes);
            }

            conn.getResponseCode(); // Trigger request
        } catch (Exception e) {
            Log.w(TAG, "Could not report status for message " + logId + ": " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private int getBatteryPercentage() {
        try {
            Intent batteryIntent = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (batteryIntent != null) {
                int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                if (level >= 0 && scale > 0) {
                    return Math.round((level / (float) scale) * 100);
                }
            }
        } catch (Exception ignored) {}
        return 100;
    }

    private boolean isBatteryCharging() {
        try {
            Intent batteryIntent = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (batteryIntent != null) {
                int status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private String getSimOperatorName() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            int selectedSubId = prefs.getInt(KEY_SELECTED_SIM_ID, -1);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && selectedSubId != -1) {
                SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                if (sm != null) {
                    List<SubscriptionInfo> list = sm.getActiveSubscriptionInfoList();
                    if (list != null) {
                        for (SubscriptionInfo info : list) {
                            if (info.getSubscriptionId() == selectedSubId) {
                                return "شريحة " + (info.getSimSlotIndex() + 1) + " (" + info.getDisplayName() + ")";
                            }
                        }
                    }
                }
            }

            TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
            if (tm != null) {
                String op = tm.getNetworkOperatorName();
                if (op != null && !op.isEmpty()) return op;
                String simOp = tm.getSimOperatorName();
                if (simOp != null && !simOp.isEmpty()) return simOp;
            }
        } catch (Exception ignored) {}
        return "SIM Network";
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "بوابة رسائل SMS Gateway",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("إشعار استمرار عمل خدمة إرسال الرسائل في خلفية الهاتف");
            channel.enableLights(false);
            channel.enableVibration(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification(String contentText) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("UniFood SMS Gateway 📱")
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentIntent(pendingIntent)
                .setOngoing(true);

        return builder.build();
    }

    private void updateNotificationText(String newText) {
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, buildForegroundNotification(newText));
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        isServiceRunning = false;

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        stopForeground(true);
        super.onDestroy();
        Log.i(TAG, "UniFood SMS Gateway service destroyed.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
