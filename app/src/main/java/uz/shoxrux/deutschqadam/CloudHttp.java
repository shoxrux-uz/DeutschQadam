package uz.shoxrux.deutschqadam;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Apps Script Web App bilan aloqa.
 * Apps Script POST javobini 302 orqali boshqa manzilga yo'naltiradi —
 * o'sha manzildan natijani GET bilan olamiz (qo'lda, ishonchli bo'lishi uchun).
 */
final class CloudHttp {

    /** Faqat Google Apps Script manzillariga ruxsat */
    static boolean allowed(String url) {
        return url != null && (url.startsWith("https://script.google.com/") || url.startsWith("https://script.googleusercontent.com/"));
    }

    /** @return {matn, null} muvaffaqiyatda yoki {null, xato} */
    static String[] post(String url, String body) {
        if (!allowed(url)) return new String[]{null, "url"};
        return send(url, body);
    }

    /** Test va ichki foydalanish uchun: manzil tekshiruvisiz */
    static String[] send(String url, String body) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
            byte[] data = body.getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(data.length);
            OutputStream os = c.getOutputStream();
            os.write(data);
            os.close();
            int code = c.getResponseCode();
            String next = c.getHeaderField("Location");
            int hops = 0;
            while (code >= 300 && code < 400 && next != null && hops < 5) {
                c.disconnect();
                c = (HttpURLConnection) new URL(new URL(url), next).openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestMethod("GET");
                code = c.getResponseCode();
                url = c.getURL().toString();
                next = c.getHeaderField("Location");
                hops++;
            }
            if (code != 200) return new String[]{null, "http " + code};
            return new String[]{read(c.getInputStream()), null};
        } catch (Exception e) {
            return new String[]{null, String.valueOf(e.getMessage())};
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        in.close();
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }
}
