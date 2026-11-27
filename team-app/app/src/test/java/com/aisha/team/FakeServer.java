package com.aisha.team;

import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okio.Buffer;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Stand-in for the Aisha dashboard server, with the same routes and JSON shapes as production. */
class FakeServer {
    static final String PASSWORD = "test-pass";
    static final String TOKEN = "tok123";
    static final String ADMIN_PASSWORD = "admin-pass";
    volatile JSONObject lastAuth;
    final java.util.Set<String> locked = java.util.Collections.synchronizedSet(new java.util.HashSet<>());
    volatile int target = 0;
    final List<JSONObject> bonusCalls = java.util.Collections.synchronizedList(new ArrayList<>());
    final List<JSONObject> assignCalls = java.util.Collections.synchronizedList(new ArrayList<>());
    final MockWebServer http = new MockWebServer();
    final List<String> log = Collections.synchronizedList(new ArrayList<>());
    final List<JSONObject> sentTexts = Collections.synchronizedList(new ArrayList<>());
    final List<JSONObject> sentPhotos = Collections.synchronizedList(new ArrayList<>());
    final List<JSONObject> statusCalls = Collections.synchronizedList(new ArrayList<>());
    final List<JSONObject> paymentCalls = Collections.synchronizedList(new ArrayList<>());
    final Map<String, String> tradeCampaign = Collections.synchronizedMap(new LinkedHashMap<>());
    static final String CHOICE_MSG = "Search Share name\n(Idea)\nAND 1st wala select kriye...\nThen quantity 1\nSelect - Market price \nDelivery mein tick krke buy kriye then screenshot bhjeye!! ☺️";
    final Map<String, String> tradeStatus = Collections.synchronizedMap(new LinkedHashMap<>());
    final Map<String, String> tradeBy = Collections.synchronizedMap(new LinkedHashMap<>());
    final long now = System.currentTimeMillis();

    FakeServer() throws Exception {
        http.setDispatcher(new Dispatcher() { @Override public MockResponse dispatch(RecordedRequest r) { return handle(r); } });
        http.start(java.net.InetAddress.getByName("127.0.0.1"), 0);
        tradeStatus.put("7581773680", "");   // Sofiya
        tradeStatus.put("111", "");          // Ravi (unread, bonus step2, today)
        tradeStatus.put("222", "");          // Anu (HDFC, 2 days ago)
        tradeStatus.put("333", "not_interested"); // Old (not interested)
        tradeStatus.put("444", "");          // Plain (TQ, no bonus)
    }

    String base() { return "http://127.0.0.1:" + http.getPort(); }
    void stop() { try { http.shutdown(); } catch (Exception ignored) { } }

    private static String iso(long t) { java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"); f.setTimeZone(java.util.TimeZone.getTimeZone("UTC")); return f.format(new java.util.Date(t)); }

    private JSONObject user(String id, String name, String apps, String bonus, int unread, long last, String lastText, String dir) throws Exception {
        JSONObject u = new JSONObject();
        u.put("id", id).put("name", name).put("phone", "+9190000" + id).put("apps", new JSONArray(apps.isEmpty() ? new String[0] : apps.split(","))).put("bonus", bonus)
            .put("tradeStatus", tradeStatus.get(id)).put("tradeStatusAt", tradeStatus.get(id).isEmpty() ? "" : iso(now)).put("tradeStatusBy", tradeBy.getOrDefault(id, "")).put("tradeCampaign", tradeCampaign.getOrDefault(id, ""))
            .put("last", new JSONObject().put("text", lastText).put("direction", dir).put("time", iso(last))).put("lastTime", last).put("unread", unread);
        return u;
    }

    private MockResponse handle(RecordedRequest ex) {
        try {
            okhttp3.HttpUrl url = ex.getRequestUrl();
            String path = url.encodedPath();
            String query = url.encodedQuery();
            String method = ex.getMethod();
            log.add(method + " " + path + (query == null ? "" : "?" + query));
            String body = ex.getBody().readUtf8();
            if (path.equals("/api/auth") && method.equals("POST")) {
                lastAuth = new JSONObject(body);
                String pw = lastAuth.optString("password");
                String role = pw.equals(ADMIN_PASSWORD) ? "master" : pw.equals(PASSWORD) ? "member" : "";
                if (role.isEmpty()) return send(401, new JSONObject().put("error", "Incorrect password."));
                return send(200, new JSONObject().put("authenticated", true).put("role", role).put("name", lastAuth.optString("name"))).addHeader("Set-Cookie", "aarohi_admin_session=" + TOKEN + "; Path=/; HttpOnly; Secure; SameSite=strict");
            }
            String cookie = ex.getHeader("Cookie");
            if (cookie == null || !cookie.equals("aarohi_admin_session=" + TOKEN)) return send(401, new JSONObject().put("error", "Unauthorized"));
            switch (path) {
                case "/api/tq": {
                    JSONArray users = new JSONArray();
                    users.put(user("111", "Ravi", "Choice", "step2", 2, now - 60000, "UPI: ravi@ybl", "in"));
                    users.put(user("7581773680", "Sofiya", "Choice,Bajaj", "step1", 0, now - 3600000, "Ok", "admin"));
                    users.put(user("222", "Anu", "HDFC", "step1", 0, now - 26 * 3600000L, "Apka Bonus Ready Hai", "bot"));
                    users.put(user("333", "Old", "Choice", "step1", 0, now - 86400000L, "nahi", "in"));
                    if (BuildConfig.TEAM_ADMIN) users.put(user("444", "Plain", "Choice", "", 0, now - 7200000L, "hi", "in")); // TQ without bonus: must be hidden in Ashish Team
                    for (int i = 0; i < users.length(); i++) { JSONObject u = users.getJSONObject(i); if (locked.contains(u.getString("id"))) u.put("locked", true).put("last", JSONObject.NULL).put("unread", 0); }
                    return send(200, new JSONObject().put("users", users).put("me", new JSONObject().put("name", "Rahul").put("target", target)));
                }
                case "/api/messages": {
                    JSONArray m = new JSONArray();
                    m.put(new JSONObject().put("id", 1).put("direction", "bot").put("text", "Apka Bonus Ready Hai ‼️").put("fileId", "").put("time", iso(now - 600000)).put("status", "sent"));
                    m.put(new JSONObject().put("id", 2).put("direction", "in").put("text", "").put("fileId", "FILE1").put("time", iso(now - 300000)).put("status", "received"));
                    m.put(new JSONObject().put("id", 3).put("direction", "in").put("text", "UPI: ravi@ybl").put("fileId", "").put("time", iso(now - 60000)).put("status", "received"));
                    int extra = 0;
                    synchronized (sentTexts) { for (JSONObject t : sentTexts) m.put(new JSONObject().put("id", 100 + extra++).put("direction", "admin").put("text", t.optString("text")).put("fileId", "").put("time", iso(now)).put("status", "manual_admin")); }
                    return send(200, new JSONObject().put("chatId", query == null ? "" : query.replace("chatId=", "")).put("messages", m));
                }
                case "/api/admin/stats": {
                    JSONObject st = new JSONObject()
                        .put("range", new JSONObject().put("label", "Aaj").put("from", "2026-11-27").put("to", "2026-11-27"))
                        .put("leads", 40)
                        .put("accounts", new JSONObject().put("total", 17).put("byApp", new JSONObject().put("Choice FinX", 12).put("Angel One", 5).put("Bajaj", 0)).put("byTask", new JSONArray().put(11).put(6).put(0)))
                        .put("trade", new JSONObject().put("payment", 4).put("done", 3).put("notInt", 1))
                        .put("bonus", new JSONObject().put("total", 110).put("replied", 55).put("noReply", 55).put("active", 90).put("unassigned", 30))
                        .put("members", new JSONArray()
                            .put(new JSONObject().put("name", "Rahul").put("assigned", 30).put("payment", 2).put("done", 2).put("notInt", 0).put("target", 5).put("todayDone", 2))
                            .put(new JSONObject().put("name", "Ashu").put("assigned", 30).put("payment", 2).put("done", 1).put("notInt", 1).put("target", 0).put("todayDone", 1)));
                    return send(200, st);
                }
                case "/api/admin/bonus": {
                    JSONObject b = new JSONObject(body); bonusCalls.add(b);
                    if (b.optString("step").equals("dry")) return send(200, new JSONObject().put("parsed", 3).put("willSend", 2)
                        .put("list", new JSONArray().put(new JSONObject().put("name", "Ravi").put("last4", "1111")).put(new JSONObject().put("name", "Anu").put("last4", "2222")))
                        .put("skipped", new JSONArray().put(new JSONObject().put("name", "Old").put("last4", "3333").put("why", "pehle se campaign mein")))
                        .put("notFound", new JSONArray()));
                    if (b.optString("step").equals("test")) return send(200, new JSONObject().put("ok", true).put("sent", 1));
                    return send(200, new JSONObject().put("started", true).put("numbers", 3));
                }
                case "/api/admin/assign": assignCalls.add(new JSONObject(body)); return send(200, new JSONObject().put("changed", 30).put("failed", 0).put("counts", new JSONObject().put("Rahul", 15).put("Ashu", 15)));
                case "/api/manual-reply": sentTexts.add(new JSONObject(body)); return send(200, new JSONObject().put("sent", true));
                case "/api/send-photo": sentPhotos.add(new JSONObject(body)); return send(200, new JSONObject().put("sent", true));
                case "/api/trade-templates":
                    return send(200, new JSONObject().put("templates", new JSONArray().put(new JSONObject().put("key", "choice").put("name", "Choice").put("message", CHOICE_MSG))));
                case "/api/trade-payment": {
                    JSONObject b = new JSONObject(body);
                    paymentCalls.add(b);
                    tradeStatus.put(b.getString("chatId"), "payment_sent");
                    tradeBy.put(b.getString("chatId"), b.optString("by"));
                    tradeCampaign.put(b.getString("chatId"), b.optString("template"));
                    return send(200, new JSONObject().put("ok", true).put("status", "payment_sent").put("at", iso(now)).put("by", b.optString("by")).put("campaign", b.optString("template")).put("textSent", true));
                }
                case "/api/trade-status": {
                    JSONObject b = new JSONObject(body);
                    statusCalls.add(b);
                    tradeStatus.put(b.getString("chatId"), b.getString("status"));
                    tradeBy.put(b.getString("chatId"), b.optString("by"));
                    return send(200, new JSONObject().put("ok", true).put("status", b.getString("status")).put("at", iso(now)).put("by", b.optString("by")));
                }
                case "/api/telegram-file": {
                    // 2x2 PNG
                    byte[] png = java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNk+M/AwMDAxMDAwMDAAAAQAgEB8xvJ5gAAAABJRU5ErkJggg==");
                    return new MockResponse().setResponseCode(200).addHeader("Content-Type", "image/png").setBody(new Buffer().write(png));
                }
                default: return send(404, new JSONObject().put("error", "not found"));
            }
        } catch (Exception e) {
            return new MockResponse().setResponseCode(500).setBody("{\"error\":\"" + e + "\"}");
        }
    }

    private static byte[] readAll(InputStream in) throws Exception { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); return o.toByteArray(); }
    private static MockResponse send(int code, JSONObject json) {
        return new MockResponse().setResponseCode(code).addHeader("Content-Type", "application/json").setBody(json.toString());
    }
}
