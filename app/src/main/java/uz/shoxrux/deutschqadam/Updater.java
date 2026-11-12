package uz.shoxrux.deutschqadam;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Yangilanishni tekshirish: GitHub'dagi eng so'nggi relizni (v1.N) telefondagi versiya bilan solishtiradi.
 * Yangisi bo'lsa — "Yangilanish chiqdi" bildirishnomasi (har bir versiya uchun bir marta).
 */
final class Updater {
    static final String API = "https://api.github.com/repos/shoxrux-uz/DeutschQadam/releases/latest";
    static final String APK_URL = "https://github.com/shoxrux-uz/DeutschQadam/releases/latest/download/DeutschQadam.apk";
    static final String CHANNEL = "app_updates";
    static final int NOTIF_ID = 7002;
    static final long INTERVAL = 6L * 60 * 60 * 1000;   // 6 soatda bir martadan ko'p tekshirmaymiz

    private Updater() { }

    @SuppressWarnings("deprecation")
    static int installed(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    /** "v1.12" → 12 */
    static int parseTag(String tag) {
        if (tag == null) return -1;
        int dot = tag.lastIndexOf('.');
        String num = (dot >= 0 ? tag.substring(dot + 1) : tag).replaceAll("[^0-9]", "");
        if (num.length() == 0) return -1;
        try { return Integer.parseInt(num); } catch (Exception e) { return -1; }
    }

    /** Internetdan eng so'nggi versiya raqamini oladi (fon oqimida chaqiring). Xato bo'lsa -1. */
    static int fetchLatest() {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(API).openConnection();
            con.setConnectTimeout(8000);
            con.setReadTimeout(8000);
            con.setRequestProperty("Accept", "application/vnd.github+json");
            con.setRequestProperty("User-Agent", "DeutschQadam-App");
            if (con.getResponseCode() != 200) return -1;
            BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return parseTag(new JSONObject(sb.toString()).optString("tag_name", ""));
        } catch (Exception e) {
            return -1;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    /**
     * Tekshirish (fon oqimida). force=false bo'lsa 6 soatda bir martadan ko'p internetga chiqmaydi.
     * @return false — internetga ulanib bo'lmadi (keyinroq qayta urinish kerak)
     */
    static boolean checkSync(Context c, boolean force) {
        SharedPreferences p = Notif.prefs(c);
        long now = System.currentTimeMillis();
        if (!force && now - p.getLong("upd_checked", 0) < INTERVAL) return true;
        int latest = fetchLatest();
        if (latest < 0) return false;
        p.edit().putLong("upd_checked", now).putInt("upd_latest", latest).apply();
        int mine = installed(c);
        if (latest > mine && p.getInt("upd_notified", 0) != latest && p.getBoolean("upd_on", true)) {
            // faqat bildirishnoma haqiqatan chiqqanda «xabar berildi» deb belgilaymiz
            if (show(c, latest)) p.edit().putInt("upd_notified", latest).apply();
        }
        return true;
    }

    /** Fon oqimida tekshirish */
    static void checkAsync(final Context c, final boolean force, final Runnable after) {
        new Thread(new Runnable() {
            @Override public void run() {
                try { checkSync(c, force); } catch (Exception ignored) { }
                if (after != null) after.run();
            }
        }).start();
    }

    static String infoJson(Context c) {
        SharedPreferences p = Notif.prefs(c);
        return "{\"installed\":" + installed(c) + ",\"latest\":" + p.getInt("upd_latest", 0)
            + ",\"on\":" + p.getBoolean("upd_on", true) + ",\"url\":\"" + APK_URL + "\"}";
    }

    static boolean show(Context c, int latest) {
        if (!Notif.permitted(c)) return false;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Yangilanishlar", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Ilovaning yangi versiyasi chiqqanda xabar beradi");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL));
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 300, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = "Deutsch Qadam v1." + latest + " tayyor. Yangilash uchun shu yerga bosing — yangi APK yuklanadi, keyin uni ochib «Обновить» ni bosing.";
        Notification n = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("🆕 Yangilanish chiqdi!")
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setColor(0xFF2B4583)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build();
        nm.notify(NOTIF_ID, n);
        return true;
    }
}
