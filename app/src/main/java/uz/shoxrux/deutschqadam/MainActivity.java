package uz.shoxrux.deutschqadam;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

/**
 * Deutsch Qadam — Android ilova.
 * Ilovaning o'zi (darslar, lug'at, o'yinlar) assets/index.html faylida.
 * Bu klass uni to'liq ekranda ochadi va telefonning ovoz tizimini (TTS) ulaydi.
 * made by shoxrux
 */
public class MainActivity extends Activity implements TextToSpeech.OnInitListener {

    private WebView web;
    private TextToSpeech tts;
    /** 0 — tayyorlanmoqda, 1 — nemischa ovoz bor, 2 — nemischa ovoz yo'q, 3 — ovoz tizimi ishlamadi */
    private volatile int ttsStatus = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });

        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");

        try {
            tts = new TextToSpeech(this, this);
        } catch (Exception e) {
            ttsStatus = 3;
        }

        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) {
            ttsStatus = 3;
            return;
        }
        int r = tts.setLanguage(Locale.GERMANY);
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            r = tts.setLanguage(Locale.GERMAN);
        }
        ttsStatus = (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) ? 2 : 1;

        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { }
            @Override public void onDone(String utteranceId) { notifyDone(utteranceId); }
            @Override public void onError(String utteranceId) { notifyDone(utteranceId); }
        });
    }

    /** JavaScript tomoniga "gap tugadi" deb xabar berish */
    private void notifyDone(final String id) {
        if (id == null) return;
        final String safeId = id.replaceAll("[^A-Za-z0-9_]", "");
        runOnUiThread(new Runnable() {
            @Override public void run() {
                if (web != null) {
                    web.evaluateJavascript("window.__ttsDone && window.__ttsDone('" + safeId + "')", null);
                }
            }
        });
    }

    /** index.html dan chaqiriladigan funksiyalar (window.AndroidTTS) */
    private class TtsBridge {
        @JavascriptInterface
        public int status() {
            return ttsStatus;
        }

        @JavascriptInterface
        public void speak(String text, float rate, float pitch, String id) {
            if (tts == null || ttsStatus != 1) {
                notifyDone(id);
                return;
            }
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            Bundle params = new Bundle();
            int res = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id);
            if (res != TextToSpeech.SUCCESS) notifyDone(id);
        }

        @JavascriptInterface
        public void stop() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public void installVoice() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Intent i = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                        startActivity(i);
                    } catch (Exception e) {
                        openTtsSettingsNow();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(new Runnable() {
                @Override public void run() { openTtsSettingsNow(); }
            });
        }
    }

    private void openTtsSettingsNow() {
        try {
            startActivity(new Intent("com.android.settings.TTS_SETTINGS"));
        } catch (Exception e) {
            try {
                startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
            } catch (Exception ignored) { }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Foydalanuvchi nemischa ovozni o'rnatib qaytgan bo'lsa — qayta tekshiramiz
        if (tts != null && ttsStatus == 2) {
            int r = tts.setLanguage(Locale.GERMANY);
            if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) {
                ttsStatus = 1;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__back && window.__back()) ? 'yes' : 'no'", value -> {
            if (value == null || !value.contains("yes")) {
                finish();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (tts != null) tts.stop();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
