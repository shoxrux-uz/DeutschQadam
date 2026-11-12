package uz.shoxrux.deutschqadam;

import android.content.Context;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * Ilova yopiq bo'lsa ham yangilanishni tekshiradi.
 * Android (WorkManager) uni taxminan har 3 soatda, internet bor paytda ishga tushiradi,
 * telefon qayta yonganda ham o'zi davom ettiradi.
 */
public class UpdateWorker extends Worker {

    static final String NAME = "dq_update_check";

    public UpdateWorker(Context context, WorkerParameters params) {
        super(context, params);
    }

    @Override
    public Result doWork() {
        boolean ok;
        try { ok = Updater.checkSync(getApplicationContext(), true); }
        catch (Exception e) { ok = false; }
        return ok ? Result.success() : Result.retry();
    }

    /** Fon tekshiruvini rejalashtirish (bir necha marta chaqirilsa ham bitta bo'lib qoladi) */
    static void schedule(Context c) {
        try {
            Constraints net = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(UpdateWorker.class, 3, TimeUnit.HOURS)
                    .setConstraints(net)
                    .build();
            WorkManager.getInstance(c.getApplicationContext())
                    .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req);
        } catch (Exception ignored) { }
    }
}
