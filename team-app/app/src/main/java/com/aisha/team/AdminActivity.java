package com.aisha.team;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Ashish Team master admin (Aarohi only, 27 Nov 2026): numbers by date, team member counts, Excel report,
 *  giving bonus users to members, and the full chat list. Opens only for the admin password login. */
public class AdminActivity extends Activity {
    private static final String[][] RANGES = { {"today", "Aaj"}, {"yesterday", "Kal"}, {"7d", "7 din"}, {"month", "Mahina"} };
    private String range = "today";
    private final List<TextView> rangeChips = new ArrayList<>();
    private LinearLayout body;
    private TextView status;
    private boolean loading;
    private JSONObject last;
    private final Runnable tick = new Runnable() { public void run() { load(); Api.MAIN.postDelayed(this, 60000); } };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (!Api.hasSession(this) || !Api.isMaster(this)) { startActivity(new Intent(this, LoginActivity.class)); finish(); return; }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(14), dp(12), dp(10), dp(6));
        TextView title = Ui.text(this, "📊 Admin", 20, Ui.TEXT, true);
        top.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        TextView chats = pill("💬 Chats", Ui.OUT);
        chats.setOnClickListener(v -> startActivity(new Intent(this, ListActivity.class).putExtra("fromAdmin", true)));
        top.addView(chats);
        TextView logout = Ui.text(this, "⏻", 18, Ui.MUTED, false);
        logout.setPadding(dp(12), dp(4), dp(4), dp(4));
        logout.setOnClickListener(v -> new AlertDialog.Builder(this).setMessage("Logout karein?").setNegativeButton("Nahi", null)
            .setPositiveButton("Haan", (d, w) -> { Api.clearSession(this); startActivity(new Intent(this, LoginActivity.class)); finish(); }).show());
        top.addView(logout);
        root.addView(top);

        LinearLayout chipsRow = new LinearLayout(this);
        chipsRow.setBackground(Ui.round(Ui.CARD, dp(10)));
        chipsRow.setPadding(dp(3), dp(3), dp(3), dp(3));
        for (String[] r : RANGES) {
            TextView tv = Ui.text(this, r[1], 13, Ui.TEXT, true);
            tv.setGravity(Gravity.CENTER);
            tv.setPadding(dp(4), dp(7), dp(4), dp(7));
            String key = r[0];
            tv.setOnClickListener(v -> { range = key; paintChips(); body.setAlpha(0.5f); load(); });
            rangeChips.add(tv);
            chipsRow.addView(tv, new LinearLayout.LayoutParams(0, -2, 1));
        }
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(-1, -2);
        clp.setMargins(dp(10), 0, dp(10), dp(4));
        root.addView(chipsRow, clp);

        status = Ui.text(this, "Loading…", 12, Ui.MUTED, false);
        status.setPadding(dp(14), dp(2), dp(14), dp(4));
        root.addView(status);

        ScrollView sv = new ScrollView(this);
        body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(10), 0, dp(10), dp(24));
        sv.addView(body);
        root.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        paintChips();
        try { String c = getSharedPreferences("aisha_team", MODE_PRIVATE).getString("admin_today", ""); if (!c.isEmpty()) render(new JSONObject(c)); } catch (Exception ignored) { }
    }

    @Override protected void onResume() { super.onResume(); Api.MAIN.removeCallbacks(tick); tick.run(); }
    @Override protected void onPause() { super.onPause(); Api.MAIN.removeCallbacks(tick); }

    private int dp(float v) { return Ui.dp(this, v); }

    private TextView pill(String s, int color) {
        TextView t = Ui.text(this, s, 13, 0xFFFFFFFF, true);
        t.setPadding(dp(12), dp(7), dp(12), dp(7));
        t.setBackground(Ui.round(color, dp(10)));
        return t;
    }

    private void paintChips() {
        for (int i = 0; i < RANGES.length; i++) {
            boolean on = RANGES[i][0].equals(range);
            rangeChips.get(i).setTextColor(on ? 0xFFFFFFFF : Ui.MUTED);
            rangeChips.get(i).setBackground(on ? Ui.round(Ui.OUT, dp(8)) : null);
        }
    }

    private void load() {
        if (loading) return;
        loading = true;
        final String asked = range;
        Api.get(this, "/api/admin/stats?range=" + asked, new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                loading = false;
                if (asked.equals("today")) getSharedPreferences("aisha_team", MODE_PRIVATE).edit().putString("admin_today", j.toString()).apply();
                if (!asked.equals(range)) { load(); return; }
                render(j);
            }
            public void fail(Exception e) {
                loading = false;
                body.setAlpha(1f);
                if (e instanceof Api.Unauthorized) { startActivity(new Intent(AdminActivity.this, LoginActivity.class)); finish(); return; }
                status.setText("Load nahi hua: " + e.getMessage());
            }
        });
    }

    // ---------- screen ----------

    private void render(JSONObject j) {
        last = j;
        body.setAlpha(1f);
        body.removeAllViews();
        JSONObject r = j.optJSONObject("range");
        status.setText((r == null ? "" : r.optString("label") + "  ·  " + r.optString("from") + (r.optString("from").equals(r.optString("to")) ? "" : " se " + r.optString("to"))) + "  ·  " + Ui.time(System.currentTimeMillis()) + " update");
        JSONObject acc = j.optJSONObject("accounts"), app = acc == null ? null : acc.optJSONObject("byApp");
        JSONArray task = acc == null ? null : acc.optJSONArray("byTask");
        JSONObject tr = j.optJSONObject("trade"), bo = j.optJSONObject("bonus");

        section("Accounts");
        row(card("Naye leads", j.optInt("leads"), Ui.ACCENT), card("Accounts", acc == null ? 0 : acc.optInt("total"), Ui.GREEN));
        // App names come from the server (Ashish Team: Angel One / Choice FinX / Bajaj; Team Dhruv: HDFC SKY / Choice / Axis Direct).
        JSONArray names = acc == null ? null : acc.optJSONArray("apps");
        if (names == null || names.length() == 0) names = new JSONArray().put("Choice FinX").put("Angel One").put("Bajaj");
        View[] cards = new View[names.length()];
        for (int i = 0; i < names.length(); i++) cards[i] = card(names.optString(i), app == null ? 0 : app.optInt(names.optString(i)), Ui.TEXT);
        row(cards);
        row(card("Task 1", task == null ? 0 : task.optInt(0), Ui.TEXT), card("Task 2", task == null ? 0 : task.optInt(1), Ui.TEXT), card("Task 3", task == null ? 0 : task.optInt(2), Ui.TEXT));

        section("Trade / Funds");
        row(card("💰 Funds bheja", tr == null ? 0 : tr.optInt("payment"), 0xFFF2B84B), card("✅ Done", tr == null ? 0 : tr.optInt("done"), Ui.GREEN), card("🚫 Not int", tr == null ? 0 : tr.optInt("notInt"), 0xFFFF8A8A));

        section("Bonus users (abhi tak)");
        row(card("Bheje", bo == null ? 0 : bo.optInt("total"), Ui.TEXT), card("Reply aaya", bo == null ? 0 : bo.optInt("replied"), Ui.GREEN), card("Reply nahi", bo == null ? 0 : bo.optInt("noReply"), 0xFFF2B84B));
        row(card("Activate/Payment mein", bo == null ? 0 : bo.optInt("active"), Ui.TEXT), card("Kisi ko nahi diye", bo == null ? 0 : bo.optInt("unassigned"), Ui.ACCENT));

        LinearLayout actions = new LinearLayout(this);
        actions.setPadding(0, dp(10), 0, 0);
        TextView excel = pill("📥 Excel report", 0xFF1F6F4A);
        excel.setGravity(Gravity.CENTER);
        excel.setOnClickListener(v -> openReport());
        TextView split = pill("👥 Users baanto", Ui.OUT);
        split.setGravity(Gravity.CENTER);
        split.setOnClickListener(v -> splitDialog());
        LinearLayout.LayoutParams a1 = new LinearLayout.LayoutParams(0, -2, 1); a1.rightMargin = dp(8);
        actions.addView(excel, a1);
        actions.addView(split, new LinearLayout.LayoutParams(0, -2, 1));
        body.addView(actions);
        TextView bonus = pill("📣 Bonus message bhejo (numbers paste karo)", 0xFFB7791F);
        bonus.setGravity(Gravity.CENTER);
        bonus.setOnClickListener(v -> bonusDialog(""));
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(-1, -2); blp.topMargin = dp(8);
        body.addView(bonus, blp);

        section("Team members");
        JSONArray ms = j.optJSONArray("members");
        if (ms == null || ms.length() == 0) body.addView(Ui.text(this, "Abhi koi team member nahi. Jo bhi app mein naam se login karega, yahan aa jayega.", 13, Ui.MUTED, false));
        LinearLayout head = memberRow("Naam", "Users", "Funds", "Done", "N.I.", "Aaj/Target", true);
        body.addView(head);
        for (int i = 0; ms != null && i < ms.length(); i++) {
            JSONObject m = ms.optJSONObject(i);
            int tg = m.optInt("target");
            LinearLayout rw = memberRow(m.optString("name"), String.valueOf(m.optInt("assigned")), String.valueOf(m.optInt("payment")), String.valueOf(m.optInt("done")),
                String.valueOf(m.optInt("notInt")), m.optInt("todayDone") + "/" + (tg > 0 ? tg : "–"), false);
            rw.setOnClickListener(v -> memberDialog(m));
            body.addView(rw);
        }
        TextView hint = Ui.text(this, "Member pe tap karo: target set karo, users dusre ko do ya wapas lo.", 12, Ui.MUTED, false);
        hint.setPadding(dp(4), dp(8), dp(4), 0);
        body.addView(hint);
    }

    private void section(String s) {
        TextView t = Ui.text(this, s, 13, Ui.ACCENT, true);
        t.setPadding(dp(4), dp(14), 0, dp(6));
        body.addView(t);
    }

    private View card(String label, int n, int color) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(12), dp(10), dp(12), dp(10));
        c.setBackground(Ui.round(Ui.CARD, dp(12)));
        c.addView(Ui.text(this, String.valueOf(n), 22, color, true));
        TextView l = Ui.text(this, label, 12, Ui.MUTED, false);
        l.setSingleLine(true);
        c.addView(l);
        return c;
    }

    private void row(View... cards) {
        LinearLayout r = new LinearLayout(this);
        for (int i = 0; i < cards.length; i++) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
            if (i < cards.length - 1) lp.rightMargin = dp(8);
            r.addView(cards[i], lp);
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.bottomMargin = dp(8);
        body.addView(r, lp);
    }

    private LinearLayout memberRow(String name, String users, String funds, String done, String ni, String tgt, boolean head) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(10), dp(head ? 6 : 11), dp(10), dp(head ? 6 : 11));
        if (!head) r.setBackground(Ui.round(Ui.CARD, dp(10)));
        int col = head ? Ui.MUTED : Ui.TEXT;
        float sz = head ? 11 : 14;
        TextView n = Ui.text(this, name, sz, col, !head); n.setSingleLine(true);
        r.addView(n, new LinearLayout.LayoutParams(0, -2, 2.2f));
        String[] vals = { users, funds, done, ni, tgt };
        float[] w = { 1, 1, 1, 0.9f, 1.5f };
        for (int i = 0; i < vals.length; i++) {
            TextView t = Ui.text(this, vals[i], sz, head ? col : i == 2 ? Ui.GREEN : col, i == 2 && !head);
            t.setGravity(Gravity.CENTER);
            t.setSingleLine(true);
            r.addView(t, new LinearLayout.LayoutParams(0, -2, w[i]));
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.bottomMargin = dp(6);
        r.setLayoutParams(lp);
        return r;
    }

    private List<String> memberNames() {
        List<String> out = new ArrayList<>();
        JSONArray ms = last == null ? null : last.optJSONArray("members");
        for (int i = 0; ms != null && i < ms.length(); i++) out.add(ms.optJSONObject(i).optString("name"));
        return out;
    }

    // ---------- actions ----------

    private void openReport() {
        Toast.makeText(this, "Report ban rahi hai…", Toast.LENGTH_SHORT).show();
        Api.get(this, "/api/admin/report-link?range=" + range, new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(j.optString("url")))); }
                catch (Exception e) { Toast.makeText(AdminActivity.this, "Browser nahi khula", Toast.LENGTH_LONG).show(); }
            }
            public void fail(Exception e) { Toast.makeText(AdminActivity.this, "Report nahi bani: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        });
    }

    /** Choose members, then who gets split: only users not given to anyone, or everyone still open (fresh split). */
    private void splitDialog() {
        List<String> names = memberNames();
        if (names.isEmpty()) { Toast.makeText(this, "Pehle team members app mein naam se login karein", Toast.LENGTH_LONG).show(); return; }
        String[] arr = names.toArray(new String[0]);
        boolean[] on = new boolean[arr.length];
        new AlertDialog.Builder(this).setTitle("Kin members mein baantna hai?")
            .setMultiChoiceItems(arr, on, (d, w, c) -> on[w] = c)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Aage", (d, w) -> {
                JSONArray pick = new JSONArray();
                for (int i = 0; i < arr.length; i++) if (on[i]) pick.put(arr[i]);
                if (pick.length() == 0) { Toast.makeText(this, "Koi member nahi chuna", Toast.LENGTH_SHORT).show(); return; }
                JSONObject bo = last == null ? null : last.optJSONObject("bonus");
                int un = bo == null ? 0 : bo.optInt("unassigned"), act = bo == null ? 0 : bo.optInt("active");
                String[] scopes = { "Sirf jo kisi ko nahi diye (" + un + ")", "Sab open users dobara baanto (" + act + ")" };
                new AlertDialog.Builder(this).setTitle("Kaun se users?")
                    .setItems(scopes, (d2, which) -> {
                        String scope = which == 0 ? "unassigned" : "active";
                        int n = which == 0 ? un : act;
                        new AlertDialog.Builder(this).setTitle("Pakka?")
                            .setMessage(n + " users " + pick.length() + " members mein barabar baante jayenge. Done / Not int wale nahi badlenge.")
                            .setNegativeButton("Nahi", null)
                            .setPositiveButton("Haan, baanto", (d3, w3) -> assign(json("members", pick, "scope", scope)))
                            .show();
                    }).show();
            }).show();
    }

    private void memberDialog(JSONObject m) {
        String name = m.optString("name");
        String[] opts = { "🎯 Daily target set karo (abhi " + m.optInt("target") + ")", "➡ Iske users dusre member ko do", "↩ Iske users wapas lo (sab dekh payenge)" };
        new AlertDialog.Builder(this).setTitle(name + " · " + m.optInt("assigned") + " users")
            .setItems(opts, (d, which) -> {
                if (which == 0) targetDialog(name, m.optInt("target"));
                else if (which == 1) moveDialog(name, m.optInt("assigned"));
                else new AlertDialog.Builder(this).setMessage(name + " ke " + m.optInt("assigned") + " open users wapas lein? Woh sab members ko dikhenge.")
                    .setNegativeButton("Nahi", null)
                    .setPositiveButton("Haan", (d2, w2) -> assign(json("clear", true, "members", new JSONArray().put(name)))).show();
            }).show();
    }

    private void targetDialog(String name, int now) {
        EditText et = new EditText(this);
        et.setInputType(InputType.TYPE_CLASS_NUMBER);
        et.setText(now > 0 ? String.valueOf(now) : "");
        LinearLayout box = new LinearLayout(this);
        box.setPadding(dp(20), dp(8), dp(20), 0);
        box.addView(et, new LinearLayout.LayoutParams(-1, -2));
        new AlertDialog.Builder(this).setTitle(name + " — roz kitne trade done?").setView(box)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save", (d, w) -> {
                int t; try { t = Integer.parseInt(et.getText().toString().trim()); } catch (Exception e) { t = 0; }
                Api.post(this, "/api/admin/members", json("name", name, "target", t), done("Target save ho gaya ✓"));
            }).show();
    }

    private void moveDialog(String from, int n) {
        List<String> others = new ArrayList<>();
        for (String s : memberNames()) if (!s.equalsIgnoreCase(from)) others.add(s);
        if (others.isEmpty()) { Toast.makeText(this, "Koi dusra member nahi hai", Toast.LENGTH_SHORT).show(); return; }
        String[] arr = others.toArray(new String[0]);
        new AlertDialog.Builder(this).setTitle(from + " ke " + n + " users kisko dein?")
            .setItems(arr, (d, which) -> new AlertDialog.Builder(this).setMessage(from + " ke " + n + " open users " + arr[which] + " ko de dein?")
                .setNegativeButton("Nahi", null)
                .setPositiveButton("Haan", (d2, w2) -> assign(json("from", from, "to", arr[which]))).show())
            .show();
    }

    private void assign(JSONObject body) {
        status.setText("Users baante ja rahe hain…");
        Api.post(this, "/api/admin/assign", body, new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                JSONObject c = j.optJSONObject("counts");
                StringBuilder sb = new StringBuilder(j.optInt("changed") + " users update ✓");
                if (c != null) for (java.util.Iterator<String> it = c.keys(); it.hasNext(); ) { String k = it.next(); sb.append("\n").append(k).append(": ").append(c.optInt(k)); }
                if (j.optInt("failed") > 0) sb.append("\n").append(j.optInt("failed")).append(" fail hue — dobara dabao");
                new AlertDialog.Builder(AdminActivity.this).setMessage(sb.toString()).setPositiveButton("OK", null).show();
                Api.needFresh = true;
                load();
            }
            public void fail(Exception e) { status.setText(""); Toast.makeText(AdminActivity.this, "Nahi hua: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        });
    }

    // ---------- Bonus campaign (28 Nov 2026) ----------
    // Paste numbers → Check (dry run, nothing sent) → optional test to admin → Pakka? → Bhejo. Report comes on Telegram.

    private String bonusMode = "step1";

    private void bonusDialog(String prefill) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(8), dp(20), 0);
        EditText et = new EditText(this);
        et.setHint("Numbers yahan paste karo (91 ke saath ya bina, ek line mein ek)");
        et.setMinLines(5);
        et.setMaxLines(10);
        et.setGravity(Gravity.TOP);
        et.setText(prefill);
        box.addView(et, new LinearLayout.LayoutParams(-1, -2));
        android.widget.RadioGroup rg = new android.widget.RadioGroup(this);
        android.widget.RadioButton r1 = new android.widget.RadioButton(this); r1.setId(1); r1.setText("Bonus Ready (naya message)");
        android.widget.RadioButton r2 = new android.widget.RadioButton(this); r2.setId(2); r2.setText("Follow-up (jinhe pehle bheja tha)");
        rg.addView(r1); rg.addView(r2);
        rg.check(bonusMode.equals("followup") ? 2 : 1);
        box.addView(rg);
        new AlertDialog.Builder(this).setTitle("📣 Bonus message").setView(box)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Check karo", (d, w) -> {
                bonusMode = rg.getCheckedRadioButtonId() == 2 ? "followup" : "step1";
                bonusDry(et.getText().toString());
            }).show();
    }

    private void bonusDry(String numbers) {
        status.setText("Numbers check ho rahe hain… (kuch bheja nahi ja raha)");
        Api.post(this, "/api/admin/bonus", json("numbers", numbers, "mode", bonusMode, "step", "dry"), new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                status.setText("");
                int will = j.optInt("willSend");
                JSONArray nf = j.optJSONArray("notFound"), sk = j.optJSONArray("skipped"), list = j.optJSONArray("list");
                StringBuilder sb = new StringBuilder();
                sb.append("Paste kiye: ").append(j.optInt("parsed")).append(" numbers\n");
                sb.append("✅ Jayega: ").append(will).append("\n");
                sb.append("⏭ Skip: ").append(sk == null ? 0 : sk.length()).append("\n");
                sb.append("❓ Bot mein nahi mile: ").append(j.has("notFoundCount") ? j.optInt("notFoundCount") : nf == null ? 0 : nf.length()).append("\n");
                if (list != null && list.length() > 0) {
                    sb.append("\nJinko jayega:\n");
                    for (int i = 0; i < Math.min(list.length(), 30); i++) { JSONObject o = list.optJSONObject(i); sb.append("• ").append(o.optString("name")).append(" (..").append(o.optString("last4")).append(")\n"); }
                    if (list.length() > 30) sb.append("… aur ").append(list.length() - 30).append("\n");
                }
                if (sk != null && sk.length() > 0) {
                    sb.append("\nSkip (kyon):\n");
                    for (int i = 0; i < Math.min(sk.length(), 15); i++) { JSONObject o = sk.optJSONObject(i); sb.append("• ").append(o.optString("name")).append(" (..").append(o.optString("last4")).append(") — ").append(o.optString("why")).append("\n"); }
                    if (sk.length() > 15) sb.append("… aur ").append(sk.length() - 15).append("\n");
                }
                if (nf != null && nf.length() > 0) {
                    sb.append("\nNahi mile:\n");
                    for (int i = 0; i < Math.min(nf.length(), 20); i++) sb.append(nf.optString(i)).append(i < Math.min(nf.length(), 20) - 1 ? ", " : "\n");
                    if (nf.length() > 20) sb.append("… aur ").append(nf.length() - 20).append("\n");
                }
                TextView tv = Ui.text(AdminActivity.this, sb.toString(), 14, Ui.TEXT, false);
                tv.setPadding(dp(20), dp(10), dp(20), dp(4));
                tv.setTextIsSelectable(true);
                ScrollView sv = new ScrollView(AdminActivity.this);
                sv.addView(tv);
                AlertDialog.Builder ab = new AlertDialog.Builder(AdminActivity.this).setTitle("Dry run — abhi kuch nahi gaya").setView(sv)
                    .setNegativeButton("Cancel", null)
                    .setNeutralButton("Mujhe test", (d, w) -> bonusTest(numbers));
                if (will > 0) ab.setPositiveButton("Bhejo (" + will + ")", (d, w) -> new AlertDialog.Builder(AdminActivity.this).setTitle("Pakka bhejna hai?")
                    .setMessage(will + " users ko Telegram pe message jayega. Wapas nahi hoga.")
                    .setNegativeButton("Nahi", null)
                    .setPositiveButton("Haan, bhejo", (d2, w2) -> bonusSend(numbers, will)).show());
                ab.show();
            }
            public void fail(Exception e) { status.setText(""); Toast.makeText(AdminActivity.this, "Check nahi hua: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        });
    }

    private void bonusTest(String numbers) {
        Api.post(this, "/api/admin/bonus", json("mode", bonusMode, "step", "test"), new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                Toast.makeText(AdminActivity.this, j.optBoolean("ok") ? "Test message aapke Telegram pe gaya ✓" : "Test nahi gaya", Toast.LENGTH_LONG).show();
                bonusDialog(numbers);
            }
            public void fail(Exception e) { Toast.makeText(AdminActivity.this, "Test nahi gaya: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        });
    }

    private void bonusSend(String numbers, int will) {
        status.setText("Bhejna shuru ho raha hai…");
        Api.post(this, "/api/admin/bonus", json("numbers", numbers, "mode", bonusMode, "step", "send"), new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                status.setText("");
                new AlertDialog.Builder(AdminActivity.this).setTitle("📣 Bhejna shuru ✓")
                    .setMessage(will + " users ko message ja raha hai. 1–3 minute mein poori report aapke Telegram pe aayegi.\n\nYe users app mein Activate list mein aa jayenge — phir 👥 Users baanto se team ko de do.")
                    .setPositiveButton("OK", null).show();
                Api.needFresh = true;
                Api.MAIN.postDelayed(() -> load(), 60000);
            }
            public void fail(Exception e) { status.setText(""); Toast.makeText(AdminActivity.this, "Nahi gaya: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        });
    }

    private Api.Done<JSONObject> done(String msg) {
        return new Api.Done<JSONObject>() {
            public void ok(JSONObject j) { Toast.makeText(AdminActivity.this, msg, Toast.LENGTH_SHORT).show(); load(); }
            public void fail(Exception e) { Toast.makeText(AdminActivity.this, "Nahi hua: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        };
    }

    private static JSONObject json(Object... kv) {
        JSONObject o = new JSONObject();
        try { for (int i = 0; i + 1 < kv.length; i += 2) o.put(String.valueOf(kv[i]), kv[i + 1]); } catch (Exception ignored) { }
        return o;
    }
}
