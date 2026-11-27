package com.aisha.team;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Talks to the Aisha dashboard server (same login and data as the web dashboard). */
public final class Api {
    public static String BASE = BuildConfig.BASE_URL; // tests point this at a local server
    private static final String COOKIE_NAME = "aarohi_admin_session";
    public static final ExecutorService IO = Executors.newFixedThreadPool(4);
    public static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final LruCache<String, Bitmap> IMAGES = new LruCache<String, Bitmap>(24 * 1024 * 1024) {
        @Override protected int sizeOf(String k, Bitmap b) { return b.getByteCount(); }
    };

    public static class Unauthorized extends Exception { }
    public interface Done<T> { void ok(T value); void fail(Exception e); }

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("aisha_team", Context.MODE_PRIVATE); }
    public static boolean hasSession(Context c) { return !prefs(c).getString("cookie", "").isEmpty(); }
    public static void clearSession(Context c) { prefs(c).edit().remove("cookie").apply(); }
    public static String memberName(Context c) { return prefs(c).getString("member", ""); }
    public static void setMemberName(Context c, String n) { prefs(c).edit().putString("member", n).apply(); }
    /** Set after a trade status change so the list skips the server's short cache. */
    public static volatile boolean needFresh = false;
    /** Replies sent from this phone (chatId → [time, text]) so the list moves that chat to the top at once. */
    public static final java.util.Map<String, Object[]> lastSent = new java.util.concurrent.ConcurrentHashMap<>();
    // Speed (27 Nov 2026): last answers kept so the list and a chat show at once, then refresh in the background.
    public static final java.util.Map<String, JSONObject> chatCache = new java.util.concurrent.ConcurrentHashMap<>();
    public static String cachedList(Context c) { return prefs(c).getString("tq_cache", ""); }
    public static void saveList(Context c, String json) { prefs(c).edit().putString("tq_cache", json).apply(); }

    private static HttpURLConnection open(Context c, String path, String method) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(BASE + path).openConnection();
        h.setRequestMethod(method);
        h.setConnectTimeout(20000);
        h.setReadTimeout(60000);
        h.setRequestProperty("Accept", "application/json");
        String cookie = prefs(c).getString("cookie", "");
        if (!cookie.isEmpty()) h.setRequestProperty("Cookie", COOKIE_NAME + "=" + cookie);
        return h;
    }

    private static byte[] readAll(InputStream in) throws Exception {
        if (in == null) return new byte[0];
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    private static JSONObject call(Context c, String path, String method, JSONObject body) throws Exception {
        HttpURLConnection h = open(c, path, method);
        if (body != null) {
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/json");
            byte[] b = body.toString().getBytes(StandardCharsets.UTF_8);
            h.setFixedLengthStreamingMode(b.length);
            try (OutputStream o = h.getOutputStream()) { o.write(b); }
        }
        int code = h.getResponseCode();
        if (code == 401) { clearSession(c); throw new Unauthorized(); }
        byte[] raw = readAll(code >= 400 ? h.getErrorStream() : h.getInputStream());
        String text = new String(raw, StandardCharsets.UTF_8);
        JSONObject json;
        try { json = new JSONObject(text); } catch (Exception e) { json = new JSONObject(); }
        if (code >= 400) {
            String msg = json.optString("error", "Server error " + code);
            String detail = json.optString("detail", "");
            throw new Exception(detail.isEmpty() ? msg : msg + ": " + detail);
        }
        return json;
    }

    public static void login(Context c, String password, Done<Boolean> done) {
        IO.execute(() -> {
            try {
                clearSession(c);
                HttpURLConnection h = open(c, "/api/auth", "POST");
                h.setDoOutput(true);
                h.setRequestProperty("Content-Type", "application/json");
                byte[] b = new JSONObject().put("password", password).toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream o = h.getOutputStream()) { o.write(b); }
                int code = h.getResponseCode();
                if (code != 200) {
                    String t = new String(readAll(h.getErrorStream()), StandardCharsets.UTF_8);
                    String msg; try { msg = new JSONObject(t).optString("error", "Login failed"); } catch (Exception e) { msg = "Login failed (" + code + ")"; }
                    throw new Exception(msg);
                }
                String token = "";
                Map<String, List<String>> headers = h.getHeaderFields();
                for (Map.Entry<String, List<String>> e : headers.entrySet()) {
                    if (e.getKey() == null || !e.getKey().equalsIgnoreCase("Set-Cookie")) continue;
                    for (String v : e.getValue()) if (v.startsWith(COOKIE_NAME + "=")) token = v.substring(COOKIE_NAME.length() + 1).split(";")[0];
                }
                if (token.isEmpty()) throw new Exception("Login cookie nahi mila");
                prefs(c).edit().putString("cookie", token).apply();
                MAIN.post(() -> done.ok(true));
            } catch (Exception e) { MAIN.post(() -> done.fail(e)); }
        });
    }

    public static void get(Context c, String path, Done<JSONObject> done) {
        IO.execute(() -> {
            try { JSONObject j = call(c, path, "GET", null); MAIN.post(() -> done.ok(j)); }
            catch (Exception e) { MAIN.post(() -> done.fail(e)); }
        });
    }

    public static void post(Context c, String path, JSONObject body, Done<JSONObject> done) {
        IO.execute(() -> {
            try { JSONObject j = call(c, path, "POST", body); MAIN.post(() -> done.ok(j)); }
            catch (Exception e) { MAIN.post(() -> done.fail(e)); }
        });
    }

    public static Bitmap cachedImage(String fileId) { return IMAGES.get(fileId); }

    /** Loads a Telegram photo through the dashboard's image proxy, scaled down to maxSide px. */
    public static void image(Context c, String fileId, int maxSide, Done<Bitmap> done) {
        Bitmap hit = IMAGES.get(fileId + "@" + maxSide);
        if (hit != null) { done.ok(hit); return; }
        IO.execute(() -> {
            try {
                HttpURLConnection h = open(c, "/api/telegram-file?file_id=" + URLEncoder.encode(fileId, "UTF-8"), "GET");
                h.setRequestProperty("Accept", "image/*");
                int code = h.getResponseCode();
                if (code == 401) { clearSession(c); throw new Unauthorized(); }
                if (code != 200) throw new Exception("Image " + code);
                byte[] raw = readAll(h.getInputStream());
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
                int s = 1;
                while (Math.max(o.outWidth, o.outHeight) / (s * 2) >= maxSide) s *= 2;
                o = new BitmapFactory.Options();
                o.inSampleSize = s;
                Bitmap bmp = BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
                if (bmp == null) throw new Exception("Image decode failed");
                IMAGES.put(fileId + "@" + maxSide, bmp);
                MAIN.post(() -> done.ok(bmp));
            } catch (Exception e) { MAIN.post(() -> done.fail(e)); }
        });
    }

    public static String enc(String s) { try { return URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; } }
}
