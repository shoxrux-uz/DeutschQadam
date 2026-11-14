package uz.shoxrux.deutschqadam;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Do'stlardan kelgan xabarlarni tekshirib, bildirishnoma chiqaradi.
 * Server (Apps Script) yangi xabarlarni keshda saqlaydi — bu so'rov juda yengil.
 * Ilova ochiq turganda bildirishnoma chiqmaydi (xabar ilovaning o'zida ko'rinadi).
 */
final class ChatPoll {
    static final String PREF = "dq_chat";
    static final String CHANNEL = "friends_chat";
    /** Ilova hozir ekranda ochiqmi (MainActivity onResume/onPause belgilaydi) */
    static volatile boolean foreground = false;

    private ChatPoll() { }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static boolean configured(Context c) {
        SharedPreferences p = prefs(c);
        return CloudHttp.allowed(p.getString("url", "")) && p.getString("uid", "").length() > 0 && p.getString("sec", "").length() > 0;
    }

    static void setup(Context c, String url, String uid, String secret) {
        SharedPreferences.Editor e = prefs(c).edit();
        if (url == null || uid == null || secret == null || uid.isEmpty() || !CloudHttp.allowed(url)) {
            e.remove("url").remove("uid").remove("sec").apply();
            cancelAll(c);
            ChatWorker.cancel(c);
            return;
        }
        boolean changed = !uid.equals(prefs(c).getString("uid", ""));
        e.putString("url", url).putString("uid", uid).putString("sec", secret);
        if (changed) e.putLong("last", 0);   // birinchi tekshiruv faqat server vaqtini oladi, eski xabarlarni ko'rsatmaydi
        e.apply();
        ChatWorker.schedule(c);
    }

    /** Ilova ochilganda: chat bildirishnomalarini yopamiz */
    static void markSeen(Context c) {
        cancelAll(c);
    }

    /** Ilova ichida ko'rilgan xabarlar (server vaqti bilan) — ular uchun bildirishnoma chiqmaydi */
    static void seen(Context c, long serverTs) {
        SharedPreferences p = prefs(c);
        if (serverTs > p.getLong("last", 0)) p.edit().putLong("last", serverTs).apply();
    }

    /** @return true — so'rov muvaffaqiyatli bajarildi */
    static synchronized boolean check(Context c) {
        if (!configured(c)) return true;
        SharedPreferences p = prefs(c);
        long since = p.getLong("last", 0);
        boolean first = since <= 0;
        String uid = p.getString("uid", "");
        try {
            JSONObject req = new JSONObject();
            req.put("action", "inbox");
            req.put("uid", uid);
            req.put("secret", p.getString("sec", ""));
            req.put("since", since);
            String[] r = CloudHttp.post(p.getString("url", ""), req.toString());
            if (r[0] == null) return false;
            JSONObject res = new JSONObject(r[0]);
            if (!res.optBoolean("ok", false)) {
                if ("auth".equals(res.optString("err", ""))) setup(c, null, null, null);
                return true;
            }
            JSONArray items = res.optJSONArray("items");
            long last = since;
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.optJSONObject(i);
                    if (it == null) continue;
                    long ts = it.optLong("ts", 0);
                    if (ts <= since) continue;
                    if (ts > last) last = ts;
                    if (uid.equals(it.optString("f", ""))) continue;
                    if (!foreground && !first) show(c, it);
                }
            }
            p.edit().putLong("last", Math.max(last, res.optLong("now", last))).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    static String[] texts(JSONObject it) {
        String k = it.optString("k", ""), n = it.optString("n", "Do'stingiz"), g = it.optString("g", ""), t = it.optString("t", "");
        if ("req".equals(k)) return new String[]{"👋 " + n, n + " sizni do'stlikka taklif qildi. Qabul qilasizmi?"};
        if ("acc".equals(k)) return new String[]{"🤝 " + n, n + " taklifingizni qabul qildi — endi yozishishingiz mumkin!"};
        if (k.startsWith("g:") && g.length() > 0) return new String[]{"👥 " + g, n + ": " + t};
        return new String[]{"💬 " + n, t};
    }

    static void show(Context c, JSONObject it) {
        if (!Notif.permitted(c)) return;
        ensureChannel(c);
        String k = it.optString("k", "");
        String[] tx = texts(it);
        int id = 9000 + (k.hashCode() & 0x3ff);
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("chat", (k.startsWith("d:") || k.startsWith("g:")) ? k : "social");
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(tx[0])
            .setContentText(tx[1])
            .setStyle(new Notification.BigTextStyle().bigText(tx[1]))
            .setColor(0xFFFF6B5B)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        nm.notify(id, n);
        String ids = prefs(c).getString("ids", "");
        if (!("," + ids + ",").contains("," + id + ",")) prefs(c).edit().putString("ids", ids.isEmpty() ? String.valueOf(id) : ids + "," + id).apply();
    }

    static void cancelAll(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        String ids = prefs(c).getString("ids", "");
        if (nm != null && !ids.isEmpty()) {
            for (String s : ids.split(",")) { try { nm.cancel(Integer.parseInt(s)); } catch (Exception ignored) { } }
        }
        prefs(c).edit().putString("ids", "").apply();
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Do'stlardan xabarlar", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Chat xabarlari va do'stlik takliflari");
            nm.createNotificationChannel(ch);
        }
    }
}
