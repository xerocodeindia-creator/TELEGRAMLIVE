package com.aisha.team;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.text.method.LinkMovementMethod;
import android.text.util.Linkify;
import android.util.Base64;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/** One user's chat: read messages and photos, reply with text or a photo. */
public class ChatActivity extends Activity {
    private static final int PICK = 7;
    private static final int PICK_PAYMENT = 8;
    private String tradeCampaign = "";
    private JSONObject paymentTemplate; // campaign chosen for the current "Payment bheja"
    static class Msg { long id; String dir, text, fileId, status; long time; boolean dayLabel, pending, photo; long keepUntil; }

    private String chatId, name, tradeStatus, tradeBy;
    private long tradeAt;
    private LinearLayout actions;
    private final List<Msg> items = new ArrayList<>();
    private ListView list;
    private Adapter adapter;
    private EditText input;
    private TextView sendBtn, info;
    private long lastSig = -1;
    private boolean loading;
    private final Runnable tick = new Runnable() { public void run() { load(); Api.MAIN.postDelayed(this, 3000); } };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        chatId = getIntent().getStringExtra("id");
        name = getIntent().getStringExtra("name");
        String phone = getIntent().getStringExtra("phone");
        String apps = getIntent().getStringExtra("apps");
        tradeStatus = getIntent().getStringExtra("tradeStatus"); if (tradeStatus == null) tradeStatus = "";
        tradeBy = getIntent().getStringExtra("tradeBy"); if (tradeBy == null) tradeBy = "";
        tradeAt = getIntent().getLongExtra("tradeAt", 0);
        tradeCampaign = getIntent().getStringExtra("tradeCampaign"); if (tradeCampaign == null) tradeCampaign = "";
        int p = Ui.dp(this, 12);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(Ui.dp(this, 6), p, p, p);
        top.setBackgroundColor(Ui.CARD);
        TextView back = Ui.text(this, "‹", 30, Ui.TEXT, false);
        back.setPadding(Ui.dp(this, 10), 0, Ui.dp(this, 14), 0);
        back.setOnClickListener(v -> finish());
        top.addView(back);
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        TextView t = Ui.text(this, name, 17, Ui.TEXT, true); t.setSingleLine(true); t.setEllipsize(TextUtils.TruncateAt.END);
        info = Ui.text(this, (phone == null || phone.isEmpty() ? "" : phone + "  ·  ") + "#" + chatId + (apps == null || apps.isEmpty() ? "" : "  ·  " + apps), 12, Ui.MUTED, false);
        titles.addView(t); titles.addView(info);
        top.addView(titles, new LinearLayout.LayoutParams(0, -2, 1));
        if (phone != null && !phone.isEmpty()) {
            TextView call = Ui.text(this, "📞", 20, Ui.TEXT, false);
            call.setPadding(p, 0, Ui.dp(this, 4), 0);
            call.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone))));
            top.addView(call);
        }
        root.addView(top);

        actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.setPadding(Ui.dp(this, 10), Ui.dp(this, 8), Ui.dp(this, 10), Ui.dp(this, 8));
        actions.setBackgroundColor(Ui.BG);
        root.addView(actions);
        renderActions();

        list = new ListView(this);
        list.setDivider(null);
        list.setSelector(android.R.color.transparent);
        list.setStackFromBottom(true);
        list.setTranscriptMode(ListView.TRANSCRIPT_MODE_NORMAL);
        list.setPadding(0, Ui.dp(this, 6), 0, Ui.dp(this, 6));
        list.setClipToPadding(false);
        adapter = new Adapter();
        list.setAdapter(adapter);
        root.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.BOTTOM);
        bar.setPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8));
        bar.setBackgroundColor(Ui.CARD);
        TextView clip = Ui.text(this, "📎", 22, Ui.TEXT, false);
        clip.setPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8));
        clip.setOnClickListener(v -> { Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.setType("image/*"); i.addCategory(Intent.CATEGORY_OPENABLE); startActivityForResult(Intent.createChooser(i, "Photo choose karo"), PICK); });
        bar.addView(clip);
        input = new EditText(this);
        input.setHint("Message likho…");
        input.setHintTextColor(Ui.MUTED);
        input.setTextColor(Ui.TEXT);
        input.setMaxLines(5);
        input.setBackground(Ui.round(Ui.BG, Ui.dp(this, 20)));
        input.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 10));
        bar.addView(input, new LinearLayout.LayoutParams(0, -2, 1));
        sendBtn = Ui.text(this, "➤", 20, 0xFFFFFFFF, true);
        sendBtn.setGravity(Gravity.CENTER);
        sendBtn.setBackground(Ui.round(Ui.OUT, Ui.dp(this, 22)));
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 44)); slp.leftMargin = Ui.dp(this, 8);
        bar.addView(sendBtn, slp);
        sendBtn.setOnClickListener(v -> sendText());
        root.addView(bar);
        setContentView(root);
        // Chat opened before: show it at once, the live history replaces it a moment later.
        JSONObject cached = Api.chatCache.get(chatId);
        if (cached != null) { applyMsgs(cached); list.setSelection(Math.max(0, items.size() - 1)); }
    }

    @Override protected void onResume() { super.onResume(); Api.MAIN.removeCallbacks(tick); tick.run(); }
    @Override protected void onPause() { super.onPause(); Api.MAIN.removeCallbacks(tick); }

    private TextView actionButton(String label, int color, Runnable onClick) {
        TextView b = Ui.text(this, label, 14, 0xFFFFFFFF, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(Ui.dp(this, 10), Ui.dp(this, 9), Ui.dp(this, 10), Ui.dp(this, 9));
        b.setBackground(Ui.round(color, Ui.dp(this, 10)));
        b.setOnClickListener(v -> onClick.run());
        return b;
    }

    /** Buttons that move the user between TQ → Payment → Done / Not interested. */
    private void renderActions() {
        actions.removeAllViews();
        actions.setOrientation(LinearLayout.VERTICAL);
        LinearLayout row = new LinearLayout(this);
        LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(0, -2, 1);
        cell.rightMargin = Ui.dp(this, 6);
        LinearLayout.LayoutParams last = new LinearLayout.LayoutParams(0, -2, 1);
        if (tradeStatus.isEmpty()) {
            row.addView(actionButton("💰 Payment", 0xFFB7791F, this::startPayment), cell);
            row.addView(actionButton("✅ Done", Ui.GREEN, () -> confirmStatus("done")), cell);
            row.addView(actionButton("🚫 Not int", 0xFFB84A4A, () -> confirmStatus("not_interested")), last);
        } else {
            String label = Ui.statusLabel(tradeStatus, tradeCampaign) + (tradeBy.isEmpty() ? "" : " · " + tradeBy) + (tradeAt > 0 ? " · " + Ui.listTime(tradeAt) : "");
            TextView st = Ui.text(this, label, 13, tradeStatus.equals("not_interested") ? 0xFFFF8A8A : tradeStatus.equals("payment_sent") ? 0xFFF2B84B : Ui.GREEN, true);
            st.setPadding(Ui.dp(this, 2), 0, 0, Ui.dp(this, 6));
            actions.addView(st);
            if (tradeStatus.equals("payment_sent")) {
                row.addView(actionButton("✅ Done", Ui.GREEN, () -> confirmStatus("done")), cell);
                row.addView(actionButton("🚫 Not int", 0xFFB84A4A, () -> confirmStatus("not_interested")), cell);
                row.addView(actionButton("↩ TQ", Ui.OUT, () -> confirmStatus("")), last);
            } else {
                row.addView(actionButton("↩ Wapas TQ mein", Ui.OUT, () -> confirmStatus("")), new LinearLayout.LayoutParams(-1, -2));
            }
        }
        actions.addView(row);
    }

    /** "Payment bheja": choose the campaign (if more than one), then the payment screenshot. */
    private void startPayment() {
        Api.get(this, "/api/trade-templates", new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                JSONArray arr = j.optJSONArray("templates");
                if (arr == null || arr.length() == 0) { Toast.makeText(ChatActivity.this, "Koi campaign message set nahi hai", Toast.LENGTH_LONG).show(); return; }
                if (arr.length() == 1) { pickPaymentScreenshot(arr.optJSONObject(0)); return; }
                String[] names = new String[arr.length()];
                for (int i = 0; i < arr.length(); i++) names[i] = arr.optJSONObject(i).optString("name");
                new AlertDialog.Builder(ChatActivity.this).setTitle("Kaunsa campaign?").setItems(names, (d, w) -> pickPaymentScreenshot(arr.optJSONObject(w))).show();
            }
            public void fail(Exception e) {
                if (e instanceof Api.Unauthorized) { startActivity(new Intent(ChatActivity.this, LoginActivity.class)); finish(); return; }
                Toast.makeText(ChatActivity.this, "Campaign load nahi hua: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void pickPaymentScreenshot(JSONObject template) {
        paymentTemplate = template;
        Toast.makeText(this, "Payment ka screenshot chuno", Toast.LENGTH_SHORT).show();
        Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.setType("image/*"); i.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(Intent.createChooser(i, "Payment screenshot"), PICK_PAYMENT);
    }

    private void confirmPayment(Bitmap preview, String b64) {
        JSONObject t = paymentTemplate;
        if (t == null) return;
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = Ui.dp(this, 16);
        box.setPadding(p, p, p, 0);
        ImageView iv = new ImageView(this);
        iv.setImageBitmap(preview); iv.setAdjustViewBounds(true); iv.setMaxHeight(Ui.dp(this, 260));
        box.addView(iv);
        TextView note = Ui.text(this, "Screenshot ke baad ye message bhi jayega:", 13, Ui.MUTED, true);
        note.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 4));
        box.addView(note);
        box.addView(Ui.text(this, t.optString("message"), 14, Ui.TEXT, false));
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        sv.addView(box);
        new AlertDialog.Builder(this)
            .setTitle("💰 Payment bhejo — " + name + " (" + t.optString("name") + ")")
            .setView(sv)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Bhejo", (d, w) -> sendPayment(t, b64))
            .show();
    }

    private void sendPayment(JSONObject t, String b64) {
        actions.setAlpha(0.5f);
        addPending("💰 Payment screenshot + " + t.optString("name") + " message bhej rahe…");
        try {
            Api.post(this, "/api/trade-payment", new JSONObject().put("chatId", chatId).put("template", t.optString("key")).put("imageBase64", b64).put("mimeType", "image/jpeg").put("by", Api.memberName(this)), new Api.Done<JSONObject>() {
                public void ok(JSONObject j) {
                    actions.setAlpha(1f);
                    tradeStatus = "payment_sent"; tradeCampaign = j.optString("campaign"); tradeBy = j.optString("by"); tradeAt = Ui.parse(j.optString("at"));
                    Api.needFresh = true;
                    Api.lastSent.put(chatId, new Object[]{ System.currentTimeMillis(), "💰 Payment screenshot" });
                    renderActions();
                    markPhotoSent();
                    lastSig = -1; load();
                    Toast.makeText(ChatActivity.this, j.optBoolean("textSent", true) ? "Payment bhej diya, user Payment tab mein ✓" : "Screenshot gaya, par message nahi gaya — chat se bhej do", Toast.LENGTH_LONG).show();
                }
                public void fail(Exception e) {
                    actions.setAlpha(1f);
                    if (!items.isEmpty()) { items.remove(items.size() - 1); adapter.notifyDataSetChanged(); }
                    if (e instanceof Api.Unauthorized) { startActivity(new Intent(ChatActivity.this, LoginActivity.class)); finish(); return; }
                    Toast.makeText(ChatActivity.this, "Payment nahi gaya: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception ignored) { actions.setAlpha(1f); }
    }

    private void confirmStatus(String status) {
        String msg = status.equals("done") ? name + " ka trade ho gaya? User Trade Qualified se hat kar Trade Done mein chala jayega."
            : status.equals("not_interested") ? name + " trade mein interested nahi hai? User Trade Qualified se hat kar Not Interested mein chala jayega."
            : name + " ko wapas Trade Qualified list mein daalein?";
        new AlertDialog.Builder(this).setMessage(msg).setNegativeButton("Cancel", null).setPositiveButton("Haan", (d, w) -> saveStatus(status)).show();
    }

    private void saveStatus(String status) {
        actions.setAlpha(0.5f);
        try {
            Api.post(this, "/api/trade-status", new JSONObject().put("chatId", chatId).put("status", status).put("by", Api.memberName(this)), new Api.Done<JSONObject>() {
                public void ok(JSONObject j) {
                    actions.setAlpha(1f);
                    tradeStatus = status; tradeBy = j.optString("by"); tradeAt = Ui.parse(j.optString("at"));
                    Api.needFresh = true;
                    renderActions();
                    if (status.isEmpty()) tradeCampaign = "";
                    Toast.makeText(ChatActivity.this, status.equals("done") ? "Trade Done mein daal diya ✓" : status.equals("not_interested") ? "Not Interested mein daal diya ✓" : "Wapas Trade Qualified mein ✓", Toast.LENGTH_SHORT).show();
                }
                public void fail(Exception e) {
                    actions.setAlpha(1f);
                    if (e instanceof Api.Unauthorized) { startActivity(new Intent(ChatActivity.this, LoginActivity.class)); finish(); return; }
                    Toast.makeText(ChatActivity.this, "Save nahi hua: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception ignored) { actions.setAlpha(1f); }
    }

    private void load() {
        if (loading) return;
        loading = true;
        Api.get(this, "/api/messages?chatId=" + Api.enc(chatId), new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                loading = false;
                Api.chatCache.put(chatId, j);
                applyMsgs(j);
            }
            public void fail(Exception e) {
                loading = false;
                if (e instanceof Api.Unauthorized) { startActivity(new Intent(ChatActivity.this, LoginActivity.class)); finish(); }
            }
        });
    }

    private void applyMsgs(JSONObject j) {
                JSONArray arr = j.optJSONArray("messages");
                List<Msg> fresh = new ArrayList<>();
                long sig = 0;
                String lastDay = "";
                for (int i = 0; arr != null && i < arr.length(); i++) {
                    JSONObject o = arr.optJSONObject(i);
                    Msg m = new Msg();
                    m.id = o.optLong("id"); m.dir = o.optString("direction"); m.text = o.optString("text");
                    m.fileId = o.optString("fileId"); m.status = o.optString("status"); m.time = Ui.parse(o.optString("time"));
                    sig = sig * 31 + m.id;
                    String d = m.time == 0 ? "" : Ui.day(m.time);
                    if (!d.isEmpty() && !d.equals(lastDay)) { Msg l = new Msg(); l.dayLabel = true; l.time = m.time; fresh.add(l); lastDay = d; }
                    fresh.add(m);
                }
                sig = sig * 31 + fresh.size();
                boolean anyPending = false; for (Msg m : items) if (m.keepUntil != 0) { anyPending = true; break; }
                if (sig == lastSig && !anyPending) return;
                lastSig = sig;
                // Keep messages sent from this phone at the bottom until the server history has them
                // (history is saved a moment after the send), at most 30 s after sending.
                long now = System.currentTimeMillis();
                for (Msg m : items) {
                    if (m.dayLabel || m.keepUntil == 0) continue;
                    if (!m.pending && now > m.keepUntil) continue;
                    boolean onServer = false;
                    if (!m.pending) for (Msg f : fresh) {
                        if (f.dayLabel || "in".equals(f.dir) || f.time < m.time - 60000) continue;
                        if (m.photo ? (f.fileId != null && !f.fileId.isEmpty()) : m.text.equals(f.text)) { onServer = true; break; }
                    }
                    if (!onServer) fresh.add(m);
                }
                items.clear(); items.addAll(fresh);
                adapter.notifyDataSetChanged();
    }


    /** A photo / payment placeholder was accepted by the server: show it as sent until the history has the photo. */
    private void markPhotoSent() {
        for (Msg m : items) if (m.pending && m.text != null && (m.text.startsWith("📷") || m.text.startsWith("💰"))) { m.pending = false; m.photo = true; m.keepUntil = System.currentTimeMillis() + 30000; }
        adapter.notifyDataSetChanged();
    }
    private void addPending(String text) {
        Msg m = new Msg(); m.dir = "admin"; m.text = text; m.pending = true; m.time = System.currentTimeMillis(); m.fileId = ""; m.keepUntil = Long.MAX_VALUE;
        items.add(m); adapter.notifyDataSetChanged(); list.setSelection(items.size() - 1);
    }

    private void sendText() {
        String text = input.getText().toString().trim();
        if (text.isEmpty()) return;
        sendBtn.setEnabled(false);
        addPending(text);
        input.setText("");
        try {
            Api.post(this, "/api/manual-reply", new JSONObject().put("chatId", chatId).put("text", text), new Api.Done<JSONObject>() {
                public void ok(JSONObject j) {
                    sendBtn.setEnabled(true);
                    Api.lastSent.put(chatId, new Object[]{ System.currentTimeMillis(), text });
                    Api.needFresh = true;
                    // Sent: show it as sent straight away (no "bhej rahe…" while the history reloads).
                    for (int i = items.size() - 1; i >= 0; i--) { Msg m = items.get(i); if (m.pending && text.equals(m.text)) { m.pending = false; m.status = "sent"; m.keepUntil = System.currentTimeMillis() + 30000; break; } }
                    adapter.notifyDataSetChanged();
                    lastSig = -1; load();
                }
                public void fail(Exception e) {
                    sendBtn.setEnabled(true);
                    items.remove(items.size() - 1); adapter.notifyDataSetChanged();
                    input.setText(text);
                    Toast.makeText(ChatActivity.this, "Message nahi gaya: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception ignored) { }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if ((req != PICK && req != PICK_PAYMENT) || res != RESULT_OK || data == null || data.getData() == null) return;
        final boolean payment = req == PICK_PAYMENT;
        Uri uri = data.getData();
        Api.IO.execute(() -> {
            try {
                BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true;
                try (InputStream in = getContentResolver().openInputStream(uri)) { BitmapFactory.decodeStream(in, null, o); }
                int s = 1; while (Math.max(o.outWidth, o.outHeight) / (s * 2) >= 1280) s *= 2;
                BitmapFactory.Options o2 = new BitmapFactory.Options(); o2.inSampleSize = s;
                Bitmap bmp; try (InputStream in = getContentResolver().openInputStream(uri)) { bmp = BitmapFactory.decodeStream(in, null, o2); }
                if (bmp == null) throw new Exception("Image nahi khuli");
                float k = Math.min(1f, 1280f / Math.max(bmp.getWidth(), bmp.getHeight()));
                if (k < 1f) bmp = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * k), Math.round(bmp.getHeight() * k), true);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, 82, out);
                String b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                Bitmap preview = bmp;
                Api.MAIN.post(() -> { if (payment) confirmPayment(preview, b64); else confirmPhoto(preview, b64); });
            } catch (Exception e) {
                Api.MAIN.post(() -> Toast.makeText(this, "Photo error: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        });
    }

    private void confirmPhoto(Bitmap preview, String b64) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = Ui.dp(this, 16);
        box.setPadding(p, p, p, 0);
        ImageView iv = new ImageView(this);
        iv.setImageBitmap(preview);
        iv.setAdjustViewBounds(true);
        iv.setMaxHeight(Ui.dp(this, 320));
        box.addView(iv);
        EditText cap = new EditText(this);
        cap.setHint("Caption (optional)");
        cap.setText(input.getText().toString().trim());
        box.addView(cap);
        new AlertDialog.Builder(this)
            .setTitle("Photo bhejo — " + name)
            .setView(box)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Send", (d, w) -> {
                String caption = cap.getText().toString().trim();
                if (caption.equals(input.getText().toString().trim())) input.setText("");
                addPending("📷 Photo bhej rahe…" + (caption.isEmpty() ? "" : "\n" + caption));
                try {
                    Api.post(this, "/api/send-photo", new JSONObject().put("chatId", chatId).put("imageBase64", b64).put("mimeType", "image/jpeg").put("caption", caption), new Api.Done<JSONObject>() {
                        public void ok(JSONObject j) { Api.lastSent.put(chatId, new Object[]{ System.currentTimeMillis(), "📷 Photo" }); Api.needFresh = true; markPhotoSent(); lastSig = -1; load(); }
                        public void fail(Exception e) {
                            items.remove(items.size() - 1); adapter.notifyDataSetChanged();
                            Toast.makeText(ChatActivity.this, "Photo nahi gayi: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                } catch (Exception ignored) { }
            })
            .show();
    }

    /** Long-press on a message (Team Dhruv): the whole message text goes to the clipboard. */
    void copyToClipboard(String s) {
        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null) return;
        cm.setPrimaryClip(ClipData.newPlainText("message", s));
        Toast.makeText(this, "Copy ho gaya ✅", Toast.LENGTH_SHORT).show();
    }

    private class Adapter extends BaseAdapter {
        public int getCount() { return items.size(); }
        public Object getItem(int i) { return items.get(i); }
        public long getItemId(int i) { return i; }
        public int getViewTypeCount() { return 2; }
        public int getItemViewType(int i) { return items.get(i).dayLabel ? 0 : 1; }

        public View getView(int pos, View convert, ViewGroup parent) {
            Msg m = items.get(pos);
            if (m.dayLabel) {
                TextView tv = convert instanceof TextView ? (TextView) convert : new TextView(ChatActivity.this);
                tv.setText(Ui.dayLabel(m.time));
                tv.setTextColor(Ui.MUTED); tv.setTextSize(12); tv.setGravity(Gravity.CENTER);
                tv.setPadding(0, Ui.dp(ChatActivity.this, 10), 0, Ui.dp(ChatActivity.this, 6));
                return tv;
            }
            Bubble h;
            if (convert == null || !(convert.getTag() instanceof Bubble)) { h = new Bubble(); convert = h.build(); convert.setTag(h); } else h = (Bubble) convert.getTag();
            boolean out = !"in".equals(m.dir);
            h.row.setGravity(out ? Gravity.END : Gravity.START);
            h.card.setBackground(Ui.round(out ? Ui.OUT : Ui.IN, Ui.dp(ChatActivity.this, 14)));
            h.who.setVisibility(out ? View.VISIBLE : View.GONE);
            h.who.setText("admin".equals(m.dir) ? "Team" : BuildConfig.BOT_NAME + " bot");
            h.text.setVisibility(m.text.isEmpty() ? View.GONE : View.VISIBLE);
            h.text.setText(m.text);
            Linkify.addLinks(h.text, Linkify.WEB_URLS);
            h.text.setMovementMethod(LinkMovementMethod.getInstance());
            h.meta.setText(m.pending ? "bhej rahe…" : Ui.time(m.time));
            { // Long-press copies the message (Team Dhruv + Ashish Team)
                final String copyText = m.text;
                View.OnLongClickListener copier = v -> { if (copyText.isEmpty()) return false; v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS); copyToClipboard(copyText); return true; };
                h.card.setOnLongClickListener(copier);
                h.text.setOnLongClickListener(copier);
                h.photo.setOnLongClickListener(copier);
            }
            if (m.fileId != null && !m.fileId.isEmpty()) {
                h.photo.setVisibility(View.VISIBLE);
                h.photo.setTag(m.fileId);
                h.photo.setImageBitmap(null);
                h.photo.setMinimumHeight(Ui.dp(ChatActivity.this, 160));
                String fid = m.fileId;
                Api.image(ChatActivity.this, fid, 720, new Api.Done<Bitmap>() {
                    public void ok(Bitmap v) { if (fid.equals(h.photo.getTag())) { h.photo.setMinimumHeight(0); h.photo.setImageBitmap(v); } }
                    public void fail(Exception e) { }
                });
                h.photo.setOnClickListener(v -> startActivity(new Intent(ChatActivity.this, PhotoActivity.class).putExtra("fileId", fid)));
            } else {
                h.photo.setVisibility(View.GONE);
                h.photo.setOnClickListener(null);
            }
            return convert;
        }
    }

    private class Bubble {
        LinearLayout row, card; TextView who, text, meta; ImageView photo;
        View build() {
            int p = Ui.dp(ChatActivity.this, 10);
            row = new LinearLayout(ChatActivity.this);
            row.setPadding(p, Ui.dp(ChatActivity.this, 3), p, Ui.dp(ChatActivity.this, 3));
            card = new LinearLayout(ChatActivity.this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(p, Ui.dp(ChatActivity.this, 7), p, Ui.dp(ChatActivity.this, 6));
            who = Ui.text(ChatActivity.this, "", 11, 0xFFBFD6FF, true);
            photo = new ImageView(ChatActivity.this);
            photo.setAdjustViewBounds(true);
            photo.setMaxHeight(Ui.dp(ChatActivity.this, 300));
            photo.setScaleType(ImageView.ScaleType.FIT_CENTER);
            text = Ui.text(ChatActivity.this, "", 15, Ui.TEXT, false);
            text.setLinkTextColor(0xFF9CCBFF);
            text.setLongClickable(true);
            meta = Ui.text(ChatActivity.this, "", 11, 0xFFAEB9CC, false);
            meta.setGravity(Gravity.END);
            card.addView(who); card.addView(photo, new LinearLayout.LayoutParams(-2, -2)); card.addView(text); card.addView(meta, new LinearLayout.LayoutParams(-1, -2));
            int max = Math.round(getResources().getDisplayMetrics().widthPixels * 0.80f);
            card.setMinimumWidth(Ui.dp(ChatActivity.this, 80));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
            row.addView(card, lp);
            text.setMaxWidth(max - 2 * p);
            photo.setMaxWidth(max - 2 * p);
            return row;
        }
    }
}
