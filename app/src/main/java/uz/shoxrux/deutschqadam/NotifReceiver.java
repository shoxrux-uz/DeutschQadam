package uz.shoxrux.deutschqadam;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Eslatma vaqti kelganda va telefon qayta yonganda ishga tushadi */
public class NotifReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (Notif.ACTION.equals(action)) {
            int slot = intent.getIntExtra("slot", -1);
            if (slot >= 0 && slot < Notif.HOURS.length) {
                try { Notif.fire(context, slot); } catch (Exception ignored) { }
                Notif.schedule(context, slot);   // ertangi kunga qayta qo'yamiz
                // Shu fursatda yangilanishni ham tekshiramiz (6 soatda bir martadan ko'p emas)
                final PendingResult pr = goAsync();
                Updater.checkAsync(context.getApplicationContext(), false, new Runnable() {
                    @Override public void run() { pr.finish(); }
                });
            }
        } else {
            // telefon qayta yondi, ilova yangilandi yoki vaqt o'zgardi — hammasini qayta rejalashtiramiz
            Notif.scheduleAll(context);
            UpdateWorker.schedule(context);
        }
    }
}
