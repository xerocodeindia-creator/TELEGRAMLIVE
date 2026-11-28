package com.aisha.team;

import android.app.Activity;
import android.content.Intent;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Trade Qualified users (same list as the dashboard filter), unread first. */
public class ListActivity extends Activity {
    static class User { String id, name, phone, apps, bonus, preview, tradeStatus, tradeBy, tradeCampaign; long lastTime, tradeAt; int unread; boolean lastIn, locked; String assignedTo = ""; }

    private final List<User> all = new ArrayList<>();
    private final List<User> shown = new ArrayList<>();
    private TextView header, status;
    private EditText search;
    private Adapter adapter;
    private boolean loading;
    // Filter chips: key → label. "all" clears the filter.
    private static final String[][] FILTERS = BuildConfig.TEAM_ADMIN
        ? new String[][] { {"all", "Sab"}, {"unread", "Unread"}, {"bonus1", "Reply nahi"}, {"bonus2", "Reply aaya"}, {"angel", "Angel One"}, {"choice", "Choice FinX"}, {"hdfc", "HDFC SKY"} }
        : new String[][] { {"all", "Sab"}, {"unread", "Unread"}, {"bonus1", "Bonus 1"}, {"bonus2", "Bonus 2"}, {"choice", "Choice"}, {"hdfc", "HDFC"}, {"bajaj", "Bajaj"} };
    private String filterKey = "all";
    private final List<TextView> chips = new ArrayList<>();
    // Tabs: Trade Qualified (no status) / Trade Done / Trade Not Interested.
    // Ashish Team (27 Nov 2026): only bonus-campaign users; first tab "Activate" (no status yet) instead of TQ.
    // The website dashboard still shows the full Trade Qualified list.
    private static final String[][] TABS = BuildConfig.TEAM_ADMIN
        ? new String[][] { {"", "🚀 Activate"}, {"payment_sent", "Payment"}, {"done", "Done"}, {"not_interested", "Not Int"} }
        : new String[][] { {"", "TQ"}, {"payment_sent", "Payment"}, {"done", "Done"}, {"not_interested", "Not Int"} };
    private String tab = "";
    private final List<TextView> tabViews = new ArrayList<>();
    // Date filter on the last message (IST day).
    private static final String[][] DATES = { {"any", "Sab dates"}, {"today", "Aaj"}, {"yday", "Kal"}, {"3d", "3 din"}, {"month", "Is mahine"} };
    private String dateKey = "month"; // default: Is mahine
    private final List<TextView> dateChips = new ArrayList<>();
    private TextView filterBtn, clearBtn;
    // Ashish Team member strip: "Aapne N trade karwaye" + today's target (from the admin).
    private TextView banner;
    private int target = 0;
    private List<User> currentBase = new ArrayList<>();
    private final Runnable tick = new Runnable() { public void run() { load(); Api.MAIN.postDelayed(this, 4000); } };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (!Api.hasSession(this)) { startActivity(new Intent(this, LoginActivity.class)); finish(); return; }
        if (Api.isMaster(this) && !getIntent().getBooleanExtra("fromAdmin", false)) { startActivity(new Intent(this, AdminActivity.class)); finish(); return; }
        int p = Ui.dp(this, 14);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);

        // Row 1: search + Filter + logout (compact).
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(Ui.dp(this, 10), Ui.dp(this, 10), Ui.dp(this, 10), Ui.dp(this, 6));
        header = Ui.text(this, "", 1, Ui.TEXT, false);
        search = new EditText(this);
        search.setHint("🔍  Naam, phone ya ID");
        search.setHintTextColor(Ui.MUTED);
        search.setTextColor(Ui.TEXT);
        search.setTextSize(14);
        search.setSingleLine(true);
        search.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 10)));
        search.setPadding(Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8));
        top.addView(search, new LinearLayout.LayoutParams(0, -2, 1));
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b2, int c) { }
            public void onTextChanged(CharSequence s, int a, int b2, int c) { filter(); }
            public void afterTextChanged(Editable e) { }
        });
        filterBtn = Ui.text(this, "Filter", 13, Ui.TEXT, true);
        filterBtn.setGravity(Gravity.CENTER);
        filterBtn.setPadding(Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8));
        LinearLayout.LayoutParams flp = new LinearLayout.LayoutParams(-2, -2); flp.leftMargin = Ui.dp(this, 8);
        filterBtn.setOnClickListener(v -> openFilters());
        top.addView(filterBtn, flp);
        TextView logout = Ui.text(this, "⏻", 18, Ui.MUTED, false);
        logout.setPadding(Ui.dp(this, 12), Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4));
        logout.setOnClickListener(v -> new android.app.AlertDialog.Builder(this).setMessage("Logout karein?").setNegativeButton("Nahi", null)
            .setPositiveButton("Haan", (d, w) -> { Api.clearSession(this); startActivity(new Intent(this, LoginActivity.class)); finish(); }).show());
        if (Api.isMaster(this)) {
            TextView adm = Ui.text(this, "📊", 18, Ui.TEXT, false);
            adm.setPadding(Ui.dp(this, 10), Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4));
            adm.setOnClickListener(v -> startActivity(new Intent(this, AdminActivity.class)));
            top.addView(adm);
        }
        top.addView(logout);
        root.addView(top);

        banner = Ui.text(this, "", 13, 0xFFFFFFFF, true);
        banner.setPadding(Ui.dp(this, 12), Ui.dp(this, 7), Ui.dp(this, 12), Ui.dp(this, 7));
        banner.setBackground(Ui.round(0xFF1F6F4A, Ui.dp(this, 10)));
        banner.setVisibility(View.GONE);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(-1, -2);
        blp.setMargins(Ui.dp(this, 10), 0, Ui.dp(this, 10), Ui.dp(this, 6));
        root.addView(banner, blp);

        // Row 2: the three lists as one thin segmented bar.
        LinearLayout tabRow = new LinearLayout(this);
        tabRow.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 10)));
        tabRow.setPadding(Ui.dp(this, 3), Ui.dp(this, 3), Ui.dp(this, 3), Ui.dp(this, 3));
        for (String[] t : TABS) {
            TextView tv = Ui.text(this, t[1], 13, Ui.TEXT, true);
            tv.setGravity(Gravity.CENTER);
            tv.setSingleLine(true);
            tv.setPadding(Ui.dp(this, 4), Ui.dp(this, 6), Ui.dp(this, 4), Ui.dp(this, 6));
            String key = t[0];
            tv.setOnClickListener(v -> { tab = key; filter(); });
            tabViews.add(tv);
            tabRow.addView(tv, new LinearLayout.LayoutParams(0, -2, 1));
        }
        LinearLayout.LayoutParams trp = new LinearLayout.LayoutParams(-1, -2);
        trp.setMargins(Ui.dp(this, 10), 0, Ui.dp(this, 10), Ui.dp(this, 4));
        root.addView(tabRow, trp);

        // Row 3: one small line — count + active filters (✕ clears them).
        LinearLayout info = new LinearLayout(this);
        info.setGravity(Gravity.CENTER_VERTICAL);
        info.setPadding(Ui.dp(this, 12), Ui.dp(this, 2), Ui.dp(this, 12), Ui.dp(this, 4));
        status = Ui.text(this, "Loading…", 12, Ui.MUTED, false);
        status.setSingleLine(true);
        status.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(status, new LinearLayout.LayoutParams(0, -2, 1));
        clearBtn = Ui.text(this, "✕ hatao", 12, Ui.ACCENT, true);
        clearBtn.setPadding(Ui.dp(this, 8), Ui.dp(this, 2), 0, Ui.dp(this, 2));
        clearBtn.setOnClickListener(v -> { filterKey = "all"; dateKey = "month"; filter(); });
        info.addView(clearBtn);
        root.addView(info);

        ListView list = new ListView(this);
        list.setDivider(null);
        list.setSelector(android.R.color.transparent);
        adapter = new Adapter();
        list.setAdapter(adapter);
        list.setOnItemClickListener((parent, view, pos, id) -> {
            User u = shown.get(pos);
            if (u.locked) { Toast.makeText(this, "🔒 Trade Done — ye chat band hai", Toast.LENGTH_SHORT).show(); return; }
            Intent i = new Intent(this, ChatActivity.class);
            i.putExtra("id", u.id); i.putExtra("name", u.name); i.putExtra("phone", u.phone); i.putExtra("apps", u.apps);
            i.putExtra("tradeStatus", u.tradeStatus); i.putExtra("tradeBy", u.tradeBy); i.putExtra("tradeAt", u.tradeAt); i.putExtra("tradeCampaign", u.tradeCampaign);
            startActivity(i);
        });
        root.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        // Show the last saved list at once; the live list replaces it a moment later.
        try { String c = Api.cachedList(this); if (!c.isEmpty()) apply(new JSONObject(c)); } catch (Exception ignored) { }
        filter();
        if (Api.memberName(this).isEmpty()) askMemberName();
    }

    @Override protected void onResume() {
        super.onResume();
        if (!Api.hasSession(this)) return;
        boolean moved = false;
        for (User u : all) {
            Object[] sent = Api.lastSent.get(u.id);
            if (sent != null && (Long) sent[0] > u.lastTime) { u.lastTime = (Long) sent[0]; u.preview = "You: " + sent[1]; u.unread = 0; moved = true; }
        }
        if (moved) { java.util.Collections.sort(all, (x, y) -> Long.compare(y.lastTime, x.lastTime)); filter(); }
        Api.MAIN.removeCallbacks(tick); tick.run();
    }
    @Override protected void onPause() { super.onPause(); Api.MAIN.removeCallbacks(tick); }

    private void load() {
        if (loading) return;
        loading = true;
        String path = Api.needFresh ? "/api/tq?fresh=1" : "/api/tq";
        Api.needFresh = false;
        Api.get(this, path, new Api.Done<JSONObject>() {
            public void ok(JSONObject j) {
                loading = false;
                Api.saveList(ListActivity.this, j.toString());
                apply(j);
            }
            public void fail(Exception e) {
                loading = false;
                if (e instanceof Api.Unauthorized) { startActivity(new Intent(ListActivity.this, LoginActivity.class)); finish(); return; }
                status.setText("Load nahi hua: " + e.getMessage() + " — dobara try ho raha hai");
            }
        });
    }

    private void apply(JSONObject j) {
                JSONObject me = j.optJSONObject("me");
                if (me != null) target = me.optInt("target", 0);
                JSONArray arr = j.optJSONArray("users");
                all.clear();
                for (int i = 0; arr != null && i < arr.length(); i++) {
                    JSONObject o = arr.optJSONObject(i);
                    User u = new User();
                    u.id = o.optString("id"); u.name = o.optString("name"); u.phone = o.optString("phone");
                    JSONArray apps = o.optJSONArray("apps");
                    List<String> a = new ArrayList<>();
                    for (int k = 0; apps != null && k < apps.length(); k++) a.add(apps.optString(k));
                    u.apps = TextUtils.join(" · ", a);
                    u.bonus = o.optString("bonus");
                    if (BuildConfig.TEAM_ADMIN && u.bonus.isEmpty()) continue; // Ashish Team: bonus-campaign users only
                    u.unread = o.optInt("unread");
                    u.lastTime = o.optLong("lastTime");
                    JSONObject last = o.optJSONObject("last");
                    u.preview = last == null ? "Koi naya message nahi (3 din)" : (last.optString("direction").equals("in") ? "" : "You: ") + last.optString("text").replace('\n', ' ');
                    u.lastIn = last != null && last.optString("direction").equals("in");
                    u.tradeStatus = o.optString("tradeStatus");
                    u.tradeBy = o.optString("tradeStatusBy");
                    u.tradeCampaign = o.optString("tradeCampaign");
                    u.tradeAt = Ui.parse(o.optString("tradeStatusAt"));
                    u.locked = o.optBoolean("locked") && Api.isMember(this);
                    u.assignedTo = o.optString("assignedTo");
                    // A reply just sent from this phone counts at once, even before the server has it.
                    Object[] sent = Api.lastSent.get(u.id);
                    if (sent != null) {
                        long t = (Long) sent[0];
                        if (t > u.lastTime) { u.lastTime = t; u.preview = "You: " + sent[1]; u.unread = 0; }
                        else Api.lastSent.remove(u.id);
                    }
                    all.add(u);
                }
                // Same order as the web dashboard: most recent message first.
                java.util.Collections.sort(all, (x, y) -> Long.compare(y.lastTime, x.lastTime));
                filter();
    }

    private boolean matches(User u, String key) {
        switch (key) {
            case "unread": return u.unread > 0;
            case "bonus1": return u.bonus.equals("step1");
            case "bonus2": return u.bonus.equals("step2");
            case "choice": return u.apps.contains("Choice");
            case "hdfc": return u.apps.contains("HDFC");
            case "angel": return u.apps.contains("Angel One");
            case "bajaj": return u.apps.contains("Bajaj");
            default: return true;
        }
    }

    private boolean inDate(User u, String key) {
        if (key.equals("any")) return true;
        if (u.lastTime == 0) return false;
        long now = System.currentTimeMillis();
        String d = Ui.day(u.lastTime);
        switch (key) {
            case "today": return d.equals(Ui.day(now));
            case "yday": return d.equals(Ui.day(now - 86400000L));
            case "3d": return d.compareTo(Ui.day(now - 2 * 86400000L)) >= 0;
            case "month": return d.startsWith(Ui.day(now).substring(0, 8));
            default: return true;
        }
    }

    /** Team member name (saved on the phone) — shown as "by" on Trade done / Not interested. */
    private void askMemberName() {
        EditText et = new EditText(this);
        et.setHint("Aapka naam");
        et.setSingleLine(true);
        int pad = Ui.dp(this, 20);
        LinearLayout box = new LinearLayout(this);
        box.setPadding(pad, Ui.dp(this, 8), pad, 0);
        box.addView(et, new LinearLayout.LayoutParams(-1, -2));
        new android.app.AlertDialog.Builder(this)
            .setTitle("Aapka naam kya hai?")
            .setMessage("Trade done / Not interested pe aapka naam dikhega.")
            .setView(box)
            .setCancelable(false)
            .setPositiveButton("Save", (d, w) -> {
                String n = et.getText().toString().trim();
                if (n.isEmpty()) askMemberName(); else Api.setMemberName(this, n);
            })
            .show();
    }

    /** One dialog with both choices: what (Unread, Bonus, app) and when (date). */
    private void openFilters() {
        int pad = Ui.dp(this, 18);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(pad, Ui.dp(this, 8), pad, 0);
        android.widget.RadioGroup what = new android.widget.RadioGroup(this);
        android.widget.RadioGroup when = new android.widget.RadioGroup(this);
        box.addView(Ui.text(this, "Kaun", 13, Ui.ACCENT, true));
        for (int i = 0; i < FILTERS.length; i++) {
            int n = 0; for (User u : currentBase) if (matches(u, FILTERS[i][0])) n++;
            android.widget.RadioButton rb = new android.widget.RadioButton(this);
            rb.setId(100 + i); rb.setText(FILTERS[i][1] + "  (" + n + ")"); rb.setChecked(FILTERS[i][0].equals(filterKey));
            what.addView(rb);
        }
        box.addView(what);
        TextView wh = Ui.text(this, "Kab (aakhri message)", 13, Ui.ACCENT, true);
        wh.setPadding(0, Ui.dp(this, 10), 0, 0);
        box.addView(wh);
        for (int i = 0; i < DATES.length; i++) {
            android.widget.RadioButton rb = new android.widget.RadioButton(this);
            rb.setId(200 + i); rb.setText(DATES[i][1]); rb.setChecked(DATES[i][0].equals(dateKey));
            when.addView(rb);
        }
        box.addView(when);
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        sv.addView(box);
        new android.app.AlertDialog.Builder(this)
            .setTitle("Filter")
            .setView(sv)
            .setNeutralButton("Clear", (d, w) -> { filterKey = "all"; dateKey = "month"; filter(); })
            .setPositiveButton("Lagao", (d, w) -> {
                int a = what.getCheckedRadioButtonId(), b2 = when.getCheckedRadioButtonId();
                if (a >= 100 && a < 100 + FILTERS.length) filterKey = FILTERS[a - 100][0];
                if (b2 >= 200 && b2 < 200 + DATES.length) dateKey = DATES[b2 - 200][0];
                filter();
            })
            .show();
    }

    private void filter() {
        String q = search.getText().toString().trim().toLowerCase(Locale.ROOT);
        shown.clear();
        int[] tabCount = new int[TABS.length];
        for (User u : all) for (int i = 0; i < TABS.length; i++) if (TABS[i][0].equals(u.tradeStatus)) tabCount[i]++;
        for (int i = 0; i < TABS.length; i++) {
            boolean on = TABS[i][0].equals(tab);
            tabViews.get(i).setText(TABS[i][1] + "  " + tabCount[i]);
            tabViews.get(i).setTextColor(on ? 0xFFFFFFFF : Ui.MUTED);
            tabViews.get(i).setBackground(on ? Ui.round(Ui.OUT, Ui.dp(this, 8)) : null);
        }
        for (int i = 0; i < dateChips.size(); i++) {
            boolean on = DATES[i][0].equals(dateKey);
            dateChips.get(i).setTextColor(on ? 0xFFFFFFFF : Ui.TEXT);
            dateChips.get(i).setBackground(Ui.round(on ? Ui.ACCENT : Ui.CARD, Ui.dp(this, 14)));
        }
        List<User> base = new ArrayList<>();
        for (User u : all) if (tab.equals(u.tradeStatus) && inDate(u, dateKey)) base.add(u);
        int unread = 0; for (User u : base) if (u.unread > 0) unread++;
        String tabName = tab.isEmpty() ? (BuildConfig.TEAM_ADMIN ? "Activate — bonus users (funds bhejne wale)" : "Trade Qualified") : tab.equals("payment_sent") ? "Payment bheja" : tab.equals("done") ? "Trade Done" : "Trade Not Interested";
        header.setText(tabName);
        currentBase = base;
        for (User u : base) {
            if (!matches(u, filterKey)) continue;
            if (q.isEmpty() || u.name.toLowerCase(Locale.ROOT).contains(q) || u.id.contains(q) || u.phone.contains(q)) shown.add(u);
        }
        // Summary line + Filter button state.
        // "Is mahine" is the default, so only other choices count as an active filter.
        boolean active = !filterKey.equals("all") || !dateKey.equals("month");
        String label = "";
        if (!dateKey.equals("month")) for (String[] d : DATES) if (d[0].equals(dateKey)) label = d[1];
        if (!filterKey.equals("all")) for (String[] f : FILTERS) if (f[0].equals(filterKey)) label = label.isEmpty() ? f[1] : label + " · " + f[1];
        int unreadShown = 0; for (User u : shown) if (u.unread > 0) unreadShown++;
        status.setText((active ? label + "  —  " : "") + shown.size() + " users" + (unreadShown > 0 ? "  ·  " + unreadShown + " unread" : ""));
        clearBtn.setVisibility(active ? View.VISIBLE : View.GONE);
        int nActive = (filterKey.equals("all") ? 0 : 1) + (dateKey.equals("month") ? 0 : 1);
        filterBtn.setText(nActive > 0 ? "Filter " + nActive : "Filter");
        filterBtn.setTextColor(nActive > 0 ? 0xFFFFFFFF : Ui.TEXT);
        filterBtn.setBackground(Ui.round(nActive > 0 ? Ui.OUT : Ui.CARD, Ui.dp(this, 10)));
        for (int i = 0; i < chips.size(); i++) {
            String key = FILTERS[i][0];
            int n = 0; for (User u : base) if (matches(u, key)) n++;
            boolean on = key.equals(filterKey);
            chips.get(i).setText(FILTERS[i][1] + "  " + n);
            chips.get(i).setTextColor(on ? 0xFFFFFFFF : Ui.TEXT);
            chips.get(i).setBackground(on ? Ui.round(Ui.OUT, Ui.dp(this, 16)) : Ui.round(Ui.CARD, Ui.dp(this, 16)));
        }
        updateBanner();
        adapter.notifyDataSetChanged();
    }

    /** Member's own score for the chosen date filter (counted on the Done time), plus today vs target. */
    private void updateBanner() {
        if (banner == null) return;
        if (!BuildConfig.TEAM_ADMIN || Api.isMaster(this)) { banner.setVisibility(View.GONE); return; }
        String me = Api.memberName(this).trim();
        if (me.isEmpty()) { banner.setVisibility(View.GONE); return; }
        long now = System.currentTimeMillis();
        int n = 0, today = 0;
        for (User u : all) {
            if (!"done".equals(u.tradeStatus) || !u.tradeBy.trim().equalsIgnoreCase(me) || u.tradeAt == 0) continue;
            if (Ui.day(u.tradeAt).equals(Ui.day(now))) today++;
            if (inDay(u.tradeAt, dateKey)) n++;
        }
        String when = "";
        for (String[] d : DATES) if (d[0].equals(dateKey)) when = d[1];
        String t = "🏆 Aapne " + n + " trade karwaye (" + when + ")";
        if (target > 0) t += "   ·   Aaj " + today + "/" + target + (today >= target ? " 🎯" : "");
        banner.setText(t);
        banner.setBackground(Ui.round(target > 0 && today >= target ? 0xFF1F6F4A : 0xFF2A3B5C, Ui.dp(this, 10)));
        banner.setVisibility(View.VISIBLE);
    }

    private boolean inDay(long t, String key) {
        if (key.equals("any")) return true;
        long now = System.currentTimeMillis();
        String d = Ui.day(t);
        switch (key) {
            case "today": return d.equals(Ui.day(now));
            case "yday": return d.equals(Ui.day(now - 86400000L));
            case "3d": return d.compareTo(Ui.day(now - 2 * 86400000L)) >= 0;
            case "month": return d.startsWith(Ui.day(now).substring(0, 8));
            default: return true;
        }
    }

    private class Adapter extends BaseAdapter {
        public int getCount() { return shown.size(); }
        public Object getItem(int i) { return shown.get(i); }
        public long getItemId(int i) { return i; }

        public View getView(int pos, View convert, ViewGroup parent) {
            Holder h;
            if (convert == null) { h = new Holder(); convert = h.build(); convert.setTag(h); } else h = (Holder) convert.getTag();
            User u = shown.get(pos);
            ((GradientDrawable) h.avatar.getBackground()).setColor(Ui.avatarColor(u.id));
            h.avatar.setText(Ui.initials(u.name));
            h.name.setText(u.name);
            h.time.setText(Ui.listTime(u.lastTime));
            h.time.setTextColor(u.unread > 0 ? Ui.GREEN : Ui.MUTED);
            if (u.locked) h.preview.setText("🔒 " + Ui.statusLabel(u.tradeStatus, u.tradeCampaign) + (u.tradeAt > 0 ? " · " + Ui.listTime(u.tradeAt) : "") + " · chat band");
            else if (u.tradeStatus != null && !u.tradeStatus.isEmpty())
                h.preview.setText(Ui.statusLabel(u.tradeStatus, u.tradeCampaign) + (u.tradeBy.isEmpty() ? "" : " · " + u.tradeBy) + (u.tradeAt > 0 ? " · " + Ui.listTime(u.tradeAt) : ""));
            else h.preview.setText(u.preview);
            String tags = u.apps;
            if (!u.bonus.isEmpty()) tags = (tags.isEmpty() ? "" : tags + " · ") + (BuildConfig.TEAM_ADMIN ? (u.bonus.equals("step2") ? "Reply aaya" : "Reply nahi") : "Bonus " + (u.bonus.equals("step2") ? "2" : "1"));
            if (Api.isMaster(ListActivity.this) && !u.assignedTo.isEmpty()) tags = (tags.isEmpty() ? "" : tags + " · ") + "👤 " + u.assignedTo;
            h.tags.setText(tags);
            h.badge.setVisibility(u.unread > 0 ? View.VISIBLE : View.GONE);
            h.badge.setText(u.unread > 99 ? "99+" : String.valueOf(u.unread));
            return convert;
        }
    }

    private class Holder {
        TextView avatar, name, time, preview, tags, badge;
        View build() {
            int p = Ui.dp(ListActivity.this, 12);
            LinearLayout row = new LinearLayout(ListActivity.this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(p, p, p, p);
            avatar = Ui.text(ListActivity.this, "", 16, 0xFFFFFFFF, true);
            avatar.setGravity(Gravity.CENTER);
            GradientDrawable circle = new GradientDrawable(); circle.setShape(GradientDrawable.OVAL); avatar.setBackground(circle);
            int s = Ui.dp(ListActivity.this, 46);
            LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(s, s); alp.rightMargin = p;
            row.addView(avatar, alp);

            LinearLayout body = new LinearLayout(ListActivity.this);
            body.setOrientation(LinearLayout.VERTICAL);
            LinearLayout line1 = new LinearLayout(ListActivity.this);
            name = Ui.text(ListActivity.this, "", 16, Ui.TEXT, true); name.setSingleLine(true); name.setEllipsize(TextUtils.TruncateAt.END);
            time = Ui.text(ListActivity.this, "", 12, Ui.MUTED, false);
            line1.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
            line1.addView(time);
            LinearLayout line2 = new LinearLayout(ListActivity.this);
            line2.setGravity(Gravity.CENTER_VERTICAL);
            preview = Ui.text(ListActivity.this, "", 14, Ui.MUTED, false); preview.setSingleLine(true); preview.setEllipsize(TextUtils.TruncateAt.END);
            badge = Ui.text(ListActivity.this, "", 12, 0xFFFFFFFF, true);
            badge.setGravity(Gravity.CENTER);
            badge.setMinWidth(Ui.dp(ListActivity.this, 22));
            badge.setPadding(Ui.dp(ListActivity.this, 6), Ui.dp(ListActivity.this, 2), Ui.dp(ListActivity.this, 6), Ui.dp(ListActivity.this, 2));
            badge.setBackground(Ui.round(Ui.GREEN, Ui.dp(ListActivity.this, 11)));
            line2.addView(preview, new LinearLayout.LayoutParams(0, -2, 1));
            line2.addView(badge);
            tags = Ui.text(ListActivity.this, "", 12, Ui.ACCENT, false);
            body.addView(line1); body.addView(line2); body.addView(tags);
            row.addView(body, new LinearLayout.LayoutParams(0, -2, 1));
            FrameLayout wrap = new FrameLayout(ListActivity.this);
            wrap.addView(row);
            return wrap;
        }
    }
}
