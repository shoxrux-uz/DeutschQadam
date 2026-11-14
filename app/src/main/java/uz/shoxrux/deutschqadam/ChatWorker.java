package uz.shoxrux.deutschqadam;

import android.content.Context;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * Ilova yopiq bo'lsa ham do'stlardan yangi xabar bor-yo'qligini tekshiradi.
 * Har ~2 daqiqada (Android quvvat tejash rejimida kechiktirishi mumkin);
 * zaxira sifatida har 15 daqiqada ham ishga tushadi.
 */
public class ChatWorker extends Worker {

    static final String PERIODIC = "dq_chat_periodic";
    static final String NEXT = "dq_chat_next";
    static final long STEP_MIN = 2;

    public ChatWorker(Context context, WorkerParameters params) {
        super(context, params);
    }

    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        if (!ChatPoll.configured(c)) return Result.success();
        try { ChatPoll.check(c); } catch (Exception ignored) { }
        next(c, STEP_MIN);
        return Result.success();
    }

    private static Constraints net() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    static void next(Context c, long minutes) {
        try {
            OneTimeWorkRequest r = new OneTimeWorkRequest.Builder(ChatWorker.class)
                    .setInitialDelay(minutes, TimeUnit.MINUTES)
                    .setConstraints(net())
                    .build();
            WorkManager.getInstance(c.getApplicationContext()).enqueueUniqueWork(NEXT, ExistingWorkPolicy.REPLACE, r);
        } catch (Exception ignored) { }
    }

    static void schedule(Context c) {
        try {
            PeriodicWorkRequest p = new PeriodicWorkRequest.Builder(ChatWorker.class, 15, TimeUnit.MINUTES)
                    .setConstraints(net())
                    .build();
            WorkManager.getInstance(c.getApplicationContext()).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, p);
        } catch (Exception ignored) { }
        next(c, STEP_MIN);
    }

    static void cancel(Context c) {
        try {
            WorkManager wm = WorkManager.getInstance(c.getApplicationContext());
            wm.cancelUniqueWork(PERIODIC);
            wm.cancelUniqueWork(NEXT);
        } catch (Exception ignored) { }
    }
}
