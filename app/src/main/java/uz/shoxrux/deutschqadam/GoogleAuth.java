package uz.shoxrux.deutschqadam;

import android.app.Activity;
import android.net.Uri;
import android.os.CancellationSignal;

import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.util.concurrent.Executor;

/**
 * «Google bilan kirish» — Android Credential Manager orqali.
 * Natija JSON ko'rinishida index.html ga qaytadi:
 *   {ok:true, idToken, email, name, picture}   yoki   {ok:false, err, msg}
 */
final class GoogleAuth {

    interface Result { void done(String json); }

    private static final Executor DIRECT = new Executor() {
        @Override public void execute(Runnable r) { r.run(); }
    };

    static void signIn(final Activity activity, String webClientId, final Result cb) {
        try {
            GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(webClientId).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(option)
                    .build();
            CredentialManager cm = CredentialManager.create(activity);
            cm.getCredentialAsync(activity, request, new CancellationSignal(), DIRECT,
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override public void onResult(GetCredentialResponse response) {
                            cb.done(fromResponse(response));
                        }
                        @Override public void onError(GetCredentialException e) {
                            cb.done(error(classify(e), e.getMessage()));
                        }
                    });
        } catch (Throwable t) {
            cb.done(error(classify(t), t.getMessage()));
        }
    }

    static void signOut(Activity activity) {
        try {
            CredentialManager.create(activity).clearCredentialStateAsync(new ClearCredentialStateRequest(),
                    new CancellationSignal(), DIRECT,
                    new CredentialManagerCallback<Void, ClearCredentialException>() {
                        @Override public void onResult(Void v) { }
                        @Override public void onError(ClearCredentialException e) { }
                    });
        } catch (Throwable ignored) { }
    }

    private static String fromResponse(GetCredentialResponse response) {
        try {
            Credential c = response.getCredential();
            if (c instanceof CustomCredential
                    && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                JSONObject o = new JSONObject();
                o.put("ok", true);
                o.put("idToken", g.getIdToken());
                o.put("email", g.getId());
                o.put("name", g.getDisplayName() == null ? "" : g.getDisplayName());
                Uri pic = g.getProfilePictureUri();
                o.put("picture", pic == null ? "" : pic.toString());
                return o.toString();
            }
            return error("bad", "Kutilmagan hisob turi: " + c.getType());
        } catch (Throwable t) {
            return error("bad", t.getMessage());
        }
    }

    /** Xato turini oddiy so'zga aylantiramiz — ekranda tushunarli xabar chiqishi uchun */
    static String classify(Throwable e) {
        String cls = e.getClass().getSimpleName();
        String msg = String.valueOf(e.getMessage());
        if (cls.contains("Cancellation") || msg.contains("cancel")) return "cancelled";
        if (cls.contains("NoCredential")) return "no_account";
        if (cls.contains("ProviderConfiguration") || msg.contains("GooglePlayServices") || msg.contains("Play services")) return "no_play";
        if (msg.contains("28444") || msg.contains("Developer console") || msg.contains("DEVELOPER_ERROR") || msg.contains("[10]")) return "config";
        if (cls.contains("Interrupted") || msg.contains("network") || msg.contains("Network")) return "net";
        return "other";
    }

    static String error(String code, String msg) {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", false);
            o.put("err", code);
            o.put("msg", msg == null ? "" : (msg.length() > 160 ? msg.substring(0, 160) : msg));
            return o.toString();
        } catch (Exception e) {
            return "{\"ok\":false,\"err\":\"" + code + "\"}";
        }
    }
}
