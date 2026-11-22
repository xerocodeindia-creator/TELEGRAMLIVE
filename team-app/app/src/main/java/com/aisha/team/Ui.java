package com.aisha.team;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class Ui {
    static final int BG = Color.parseColor("#0F141D");
    static final int CARD = Color.parseColor("#172030");
    static final int LINE = Color.parseColor("#243047");
    static final int TEXT = Color.parseColor("#E6ECF7");
    static final int MUTED = Color.parseColor("#8A97AE");
    static final int ACCENT = Color.parseColor("#5AA8F0");
    static final int GREEN = Color.parseColor("#2FBF71");
    static final int OUT = Color.parseColor("#2B5BB8");
    static final int IN = Color.parseColor("#1E293B");
    private static final int[] AVATARS = { 0xFFE17076, 0xFF7BC862, 0xFFE5A64E, 0xFF65AADD, 0xFFA695E7, 0xFFEE7AAE, 0xFF6EC9CB, 0xFFFAA774 };
    private static final TimeZone IST = TimeZone.getTimeZone("Asia/Kolkata");

    static int dp(Context c, float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics())); }

    static GradientDrawable round(int color, float radiusPx) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(radiusPx); return g; }

    static TextView text(Context c, String s, float sp, int color, boolean bold) {
        TextView t = new TextView(c);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    static int avatarColor(String id) { long h = 0; for (char ch : id.toCharArray()) h = (h * 31 + ch) & 0xffffffffL; return AVATARS[(int) (h % AVATARS.length)]; }

    static String initials(String name) {
        String[] p = name.replaceAll("[^\\p{L}\\p{N} ]", " ").trim().split("\\s+");
        String a = p.length > 0 && !p[0].isEmpty() ? p[0].substring(0, 1) : "?";
        String b = p.length > 1 && !p[1].isEmpty() ? p[1].substring(0, 1) : "";
        return (a + b).toUpperCase(Locale.ROOT);
    }

    static long parse(String iso) {
        if (iso == null || iso.isEmpty()) return 0;
        try {
            SimpleDateFormat f = new SimpleDateFormat(iso.contains(".") ? "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" : "yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(iso);
            return d == null ? 0 : d.getTime();
        } catch (Exception e) { return 0; }
    }

    private static String fmt(String pattern, long t) { SimpleDateFormat f = new SimpleDateFormat(pattern, new Locale("en", "IN")); f.setTimeZone(IST); return f.format(new Date(t)); }
    static String day(long t) { return fmt("yyyy-MM-dd", t); }
    static String time(long t) { return t == 0 ? "" : fmt("h:mm a", t).toLowerCase(Locale.ROOT); }

    static String listTime(long t) {
        if (t == 0) return "";
        long now = System.currentTimeMillis();
        if (day(t).equals(day(now))) return time(t);
        if (day(t).equals(day(now - 86400000L))) return "Kal";
        return fmt("d MMM", t);
    }

    static String statusLabel(String status, String campaign) {
        switch (status) {
            case "payment_sent": return "💰 Payment bheja" + (campaign == null || campaign.isEmpty() ? "" : " · " + Character.toUpperCase(campaign.charAt(0)) + campaign.substring(1));
            case "done": return "✅ Trade done";
            case "not_interested": return "🚫 Not interested";
            default: return "";
        }
    }

    static String dayLabel(long t) {
        long now = System.currentTimeMillis();
        if (day(t).equals(day(now))) return "Aaj";
        if (day(t).equals(day(now - 86400000L))) return "Kal";
        return fmt("d MMM yyyy", t);
    }
}
