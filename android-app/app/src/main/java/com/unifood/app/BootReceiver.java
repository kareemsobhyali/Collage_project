package com.unifood.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            try {
                SharedPreferences prefs = context.getSharedPreferences(
                        UniFoodNotificationService.PREFS_NAME,
                        Context.MODE_PRIVATE
                );
                boolean isActive = prefs.getBoolean(UniFoodNotificationService.KEY_IS_ACTIVE, false);

                if (isActive) {
                    Intent serviceIntent = new Intent(context, UniFoodNotificationService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                }
            } catch (Exception ignored) {
            }
        }
    }
}
