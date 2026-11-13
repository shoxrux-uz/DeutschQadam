package uz.shoxrux.deutschqadam;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Kunlik eslatmalar (bildirishnomalar).
 *  09:00, 12:00, 18:00 — kunlik maqsad bajarilmagan bo'lsa eslatadi;
 *  21:00 — maqsad bajarilgan bo'lsa tabriklaydi.
 * Ilova (index.html) har safar XP o'zgarganda holatni notifSync() orqali shu yerga yozib qo'yadi.
 */
final class Notif {
    static final int[] HOURS = {9, 12, 18, 21};
    static final String PREF = "dq_notif";
    static final String CHANNEL = "daily_reminders";
    static final int NOTIF_ID = 7001;
    static final String ACTION = "uz.shoxrux.deutschqadam.REMIND";

    private Notif() { }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static boolean enabled(Context c) {
        return prefs(c).getBoolean("on", true);
    }

    static String dayKey(Date d) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(d);
    }

    static String today() {
        return dayKey(new Date());
    }

    static String yesterday() {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, -1);
        return dayKey(cal.getTime());
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Kunlik eslatmalar", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Kunlik maqsad bo'yicha eslatma va tabriklar");
            nm.createNotificationChannel(ch);
        }
    }

    static boolean permitted(Context c) {
        if (Build.VERSION.SDK_INT >= 33) {
            return c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || nm.areNotificationsEnabled();
    }

    private static PendingIntent alarmIntent(Context c, int slot) {
        Intent i = new Intent(c, NotifReceiver.class);
        i.setAction(ACTION);
        i.putExtra("slot", slot);
        return PendingIntent.getBroadcast(c, 100 + slot, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Bitta eslatmani keyingi vaqtga qo'yish (bugun o'tib ketgan bo'lsa — ertaga) */
    static void schedule(Context c, int slot) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c, slot);
        if (!enabled(c)) { am.cancel(pi); return; }
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, HOURS[slot]);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 1000) cal.add(Calendar.DAY_OF_YEAR, 1);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
    }

    static void scheduleAll(Context c) {
        for (int i = 0; i < HOURS.length; i++) schedule(c, i);
    }

    static void cancelShown(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIF_ID);
    }

    /** Vaqti kelganda: holatni tekshirib, kerak bo'lsa bildirishnoma chiqaradi */
    static void fire(Context c, int slot) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("on", true)) return;
        String today = today();
        String sentKey = "sent_" + slot;
        if (today.equals(p.getString(sentKey, ""))) return;        // bugun bu vaqtda allaqachon yuborilgan
        String[] msg = compose(p, slot, today, yesterday());
        if (msg == null) return;
        p.edit().putString(sentKey, today).apply();
        show(c, msg[0], msg[1]);
    }

    /** Qaysi xabarni yuborish kerakligini hal qiladi. null — hech narsa yubormaslik */
    static String[] compose(SharedPreferences p, int slot, String today, String yesterday) {
        String day = p.getString("day", "");
        boolean isToday = today.equals(day);
        int xp = isToday ? p.getInt("xp", 0) : 0;
        int goal = Math.max(1, p.getInt("goal", 50));
        int streak = p.getInt("streak", 0);
        boolean active = p.getBoolean("active", false);
        boolean activeToday = isToday && active;
        boolean streakRisk = streak > 0 && !activeToday && (isToday || (yesterday.equals(day) && active));
        String name = p.getString("name", "");
        String nm = name.length() > 0 ? ", " + name : "";
        boolean done = xp >= goal;
        int left = goal - xp;

        // Matnlar Musofir tilidan: XP — kemaning yoqilg'isi, seriya — radio aloqa
        if (slot == 3) {
            if (!done) return null;                                  // 21:00 — faqat maqsad bajarilgan bo'lsa
            return new String[]{"Gute Nacht" + nm + "! \uD83C\uDF19",
                "\uD83D\uDC7D Musofir: bugun kemaga " + xp + " XP yoqilg'i quydingiz — kunlik reja bajarildi. Yaxshi dam oling! \uD83C\uDF89"};
        }
        if (done) return null;                                       // maqsad bajarilgan — bezovta qilmaymiz
        if (slot == 0) {
            return new String[]{"Guten Morgen" + nm + "! \u2600\uFE0F", xp > 0
                ? "\uD83D\uDC7D Yaxshi boshladik! Kemaga yana " + left + " XP yoqilg'i kerak."
                : "\uD83D\uDC7D Kemam yoqilg'i kutyapti: bugun " + goal + " XP. Ertalabki 5 daqiqa — eng samarali vaqt."};
        }
        if (slot == 1) {
            return new String[]{"Mahlzeit" + nm + "! \uD83C\uDF7D\uFE0F", xp > 0
                ? "\uD83D\uDC7D Yarim yo'ldamiz: maqsadga yana " + left + " XP qoldi. Tushlikda 10 daqiqa ajratamizmi?"
                : "\uD83D\uDC7D Tushlikda 10 ta so'z? Bugun hali boshlanmadi — antennam sizni sog'indi \uD83D\uDCE1"};
        }
        if (streakRisk) {
            return new String[]{"\uD83D\uDCE1 " + streak + " kunlik seriyangiz xavf ostida!",
                "\uD83D\uDC7D Musofir: bugun hali signal yo'q. Bitta kichik mashq radio aloqamizni saqlab qoladi."};
        }
        return new String[]{"Guten Abend" + nm + "! \uD83C\uDF06", xp > 0
            ? "\uD83D\uDC7D Oz qoldi! Kemaga yana " + left + " XP kerak."
            : "\uD83D\uDC7D Kun tugayapti, kemam esa bo'sh turibdi. Maqsadga " + goal + " XP — bitta mashq bilan boshlaymiz?"};
    }

    static void show(Context c, String title, String text) {
        if (!permitted(c)) return;
        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 200, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setColor(0xFFFF6B5B)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, n);
    }
}
