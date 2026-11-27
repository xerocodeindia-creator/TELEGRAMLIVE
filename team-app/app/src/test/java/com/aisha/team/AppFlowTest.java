package com.aisha.team;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;


import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadows.ShadowAlertDialog;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
@LooperMode(LooperMode.Mode.PAUSED)
public class AppFlowTest {
    private FakeServer server;
    private Context ctx;

    @Before public void setUp() throws Exception {
        server = new FakeServer();
        Api.BASE = server.base();
        ctx = org.robolectric.RuntimeEnvironment.getApplication();
        Api.clearSession(ctx);
        Api.setMemberName(ctx, "");
        Api.needFresh = false;
        Api.lastSent.clear();
        Api.resetImageState();
    }
    @After public void tearDown() { server.stop(); }

    private static void waitFor(String what, BooleanSupplier ok) throws Exception {
        long end = System.currentTimeMillis() + 8000;
        while (System.currentTimeMillis() < end) {
            shadowOf(Looper.getMainLooper()).idle();
            if (ok.getAsBoolean()) return;
            Thread.sleep(40);
        }
        shadowOf(Looper.getMainLooper()).idle();
        assertTrue("Timed out waiting for: " + what, ok.getAsBoolean());
    }

    private static List<TextView> texts(View v) {
        List<TextView> out = new ArrayList<>();
        if (v instanceof TextView) out.add((TextView) v);
        if (v instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) v).getChildCount(); i++) out.addAll(texts(((ViewGroup) v).getChildAt(i)));
        return out;
    }
    private static TextView findText(View root, String startsWith) {
        for (TextView t : texts(root)) if (t.getText().toString().startsWith(startsWith)) return t;
        return null;
    }
    private static ListView findList(View v) {
        if (v instanceof ListView) return (ListView) v;
        if (v instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) v).getChildCount(); i++) { ListView l = findList(((ViewGroup) v).getChildAt(i)); if (l != null) return l; }
        return null;
    }
    private static List<String> rowNames(ListView lv) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < lv.getAdapter().getCount(); i++) out.add(((ListActivity.User) lv.getAdapter().getItem(i)).name);
        return out;
    }
    private void loginSession(String name) {
        ctx.getSharedPreferences("aisha_team", Context.MODE_PRIVATE).edit().putString("cookie", FakeServer.TOKEN).apply();
        Api.setMemberName(ctx, name);
    }

    @Test public void login_savesSessionAndName_wrongPasswordShowsError() throws Exception {
        LoginActivity a = Robolectric.buildActivity(LoginActivity.class).setup().get();
        View root = a.getWindow().getDecorView();
        List<EditText> edits = new ArrayList<>();
        for (TextView t : texts(root)) if (t instanceof EditText) edits.add((EditText) t);
        assertEquals("name + password fields", 2, edits.size());
        edits.get(0).setText("Rahul");
        edits.get(1).setText("wrong");
        TextView btn = findText(root, "Login");
        btn.performClick();
        waitFor("wrong password error", () -> findText(root, "Incorrect password") != null);
        assertFalse(Api.hasSession(ctx));
        edits.get(1).setText(FakeServer.PASSWORD);
        btn.performClick();
        waitFor("session saved", () -> Api.hasSession(ctx));
        assertEquals("Rahul", Api.memberName(ctx));
        waitFor("list screen opened", () -> shadowOf(a).peekNextStartedActivity() != null);
        Intent next = shadowOf(a).getNextStartedActivity();
        assertEquals(ListActivity.class.getName(), next.getComponent().getClassName());
    }

    @Test public void list_tabs_filters_dates_search() throws Exception {
        loginSession("Rahul");
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        ListActivity a = c.get();
        View root = a.getWindow().getDecorView();
        ListView lv = findList(root);
        waitFor("list loaded", () -> lv.getAdapter().getCount() > 0);
        assertTrue(server.log.toString(), server.log.contains("GET /api/tq"));
        // TQ tab: Ravi, Sofiya, Anu (Old is not interested)
        if (BuildConfig.IS_AAROHI) {
            // Ashish Team: bonus-campaign users only (Plain has no bonus), first tab is "Activate"
            assertEquals(List.of("Ravi", "Sofiya", "Anu"), rowNames(lv));
            assertNotNull("tab counts", findText(root, "🚀 Activate  3"));
        } else {
            assertEquals(List.of("Ravi", "Sofiya", "Anu"), rowNames(lv));
            assertNotNull("tab counts", findText(root, "TQ  3"));
        }
        assertNotNull(findText(root, "Done  0"));
        assertNotNull(findText(root, "Not Int  1"));
        assertNotNull(findText(root, "Payment  0"));
        // Not Int tab
        findText(root, "Not Int").performClick();
        assertEquals(List.of("Old"), rowNames(lv));
        findText(root, BuildConfig.IS_AAROHI ? "🚀 Activate" : "TQ").performClick();
        // Filter dialog: Unread
        findText(root, "Filter").performClick();
        AlertDialog d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        RadioGroup what = null, when = null;
        for (View v : allViews(d.getWindow().getDecorView())) if (v instanceof RadioGroup) { if (what == null) what = (RadioGroup) v; else when = (RadioGroup) v; }
        ((RadioButton) what.getChildAt(1)).setChecked(true); // Unread
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("Ravi"), rowNames(lv));
        assertNotNull("active filter line", findText(root, "Unread"));
        assertEquals("Filter 1", findText(root, "Filter").getText().toString());
        // ✕ hatao clears
        findText(root, "✕ hatao").performClick();
        assertEquals(3, lv.getAdapter().getCount());
        // Date: Aaj → only Ravi (last message 1 min ago); 3 din → Ravi, Sofiya, Anu
        findText(root, "Filter").performClick();
        d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        what = null; when = null;
        for (View v : allViews(d.getWindow().getDecorView())) if (v instanceof RadioGroup) { if (what == null) what = (RadioGroup) v; else when = (RadioGroup) v; }
        ((RadioButton) when.getChildAt(1)).setChecked(true); // Aaj
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        List<String> today = rowNames(lv);
        assertTrue("Ravi today", today.contains("Ravi"));
        assertFalse("Anu was 2 days ago", today.contains("Anu"));
        findText(root, "✕ hatao").performClick();
        // Bonus 2 filter
        findText(root, "Filter").performClick();
        d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        what = null;
        for (View v : allViews(d.getWindow().getDecorView())) if (v instanceof RadioGroup && what == null) what = (RadioGroup) v;
        ((RadioButton) what.getChildAt(3)).setChecked(true); // Bonus 2
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("Ravi"), rowNames(lv));
        findText(root, "✕ hatao").performClick();
        // Search
        EditText search = null;
        for (TextView t : texts(root)) if (t instanceof EditText) search = (EditText) t;
        search.setText("sof");
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("Sofiya"), rowNames(lv));
        search.setText("90000222");
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("Anu"), rowNames(lv));
        search.setText("");
        // Tap a row opens the chat with its data
        lv.performItemClick(lv, 1, 1);
        Intent i = shadowOf(a).getNextStartedActivity();
        assertEquals(ChatActivity.class.getName(), i.getComponent().getClassName());
        assertEquals("7581773680", i.getStringExtra("id"));
        c.pause().stop().destroy();
    }

    @Test public void markTradeDone_movesUserToDoneTab_withName_andUndo() throws Exception {
        loginSession("Rahul");
        Intent in = new Intent(ctx, ChatActivity.class).putExtra("id", "7581773680").putExtra("name", "Sofiya").putExtra("phone", "+9190000").putExtra("apps", "Choice").putExtra("tradeStatus", "");
        ActivityController<ChatActivity> cc = Robolectric.buildActivity(ChatActivity.class, in).setup();
        ChatActivity chat = cc.get();
        View root = chat.getWindow().getDecorView();
        findText(root, "✅ Done").performClick();
        AlertDialog d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        waitFor("status saved", () -> server.statusCalls.size() == 1);
        JSONObject call = server.statusCalls.get(0);
        assertEquals("7581773680", call.getString("chatId"));
        assertEquals("done", call.getString("status"));
        assertEquals("Rahul", call.getString("by"));
        waitFor("undo button shown", () -> findText(root, BuildConfig.IS_AAROHI ? "↩ Wapas Activate mein" : "↩ Wapas TQ mein") != null);
        assertNotNull(findText(root, "✅ Trade done · Rahul"));
        cc.pause().stop().destroy();

        // Back on the list: fresh load, Sofiya in Done, not in TQ
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        View lroot = c.get().getWindow().getDecorView();
        ListView lv = findList(lroot);
        waitFor("list loaded", () -> lv.getAdapter().getCount() > 0);
        assertTrue("fresh list after status change", server.log.contains("GET /api/tq?fresh=1"));
        assertFalse(rowNames(lv).contains("Sofiya"));
        findText(lroot, "Done").performClick();
        assertEquals(List.of("Sofiya"), rowNames(lv));
        View row = lv.getAdapter().getView(0, null, lv);
        assertNotNull("row shows who marked", findText(row, "✅ Trade done · Rahul"));
        c.pause().stop().destroy();

        // Undo
        Intent in2 = new Intent(in).putExtra("tradeStatus", "done").putExtra("tradeBy", "Rahul");
        ActivityController<ChatActivity> cc2 = Robolectric.buildActivity(ChatActivity.class, in2).setup();
        View r2 = cc2.get().getWindow().getDecorView();
        findText(r2, BuildConfig.IS_AAROHI ? "↩ Wapas Activate mein" : "↩ Wapas TQ mein").performClick();
        ((AlertDialog) ShadowAlertDialog.getLatestDialog()).getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        waitFor("undo saved", () -> server.statusCalls.size() == 2);
        assertEquals("", server.statusCalls.get(1).getString("status"));
        waitFor("buttons back", () -> findText(r2, "🚫 Not int") != null);
        cc2.pause().stop().destroy();
    }

    @Test public void notInterested_movesUser() throws Exception {
        loginSession("Rahul");
        Intent in = new Intent(ctx, ChatActivity.class).putExtra("id", "222").putExtra("name", "Anu").putExtra("tradeStatus", "");
        ActivityController<ChatActivity> cc = Robolectric.buildActivity(ChatActivity.class, in).setup();
        View root = cc.get().getWindow().getDecorView();
        findText(root, "🚫 Not int").performClick();
        ((AlertDialog) ShadowAlertDialog.getLatestDialog()).getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        waitFor("saved", () -> server.statusCalls.size() == 1);
        assertEquals("not_interested", server.statusCalls.get(0).getString("status"));
        cc.pause().stop().destroy();
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        View lroot = c.get().getWindow().getDecorView();
        ListView lv = findList(lroot);
        waitFor("list loaded", () -> lv.getAdapter().getCount() > 0);
        assertFalse(rowNames(lv).contains("Anu"));
        assertNotNull(findText(lroot, "Not Int  2"));
        c.pause().stop().destroy();
    }

    @Test public void chat_loadsMessages_image_sendText_sendPhoto() throws Exception {
        loginSession("Rahul");
        Intent in = new Intent(ctx, ChatActivity.class).putExtra("id", "111").putExtra("name", "Ravi").putExtra("tradeStatus", "");
        ActivityController<ChatActivity> cc = Robolectric.buildActivity(ChatActivity.class, in).setup();
        ChatActivity chat = cc.get();
        View root = chat.getWindow().getDecorView();
        ListView lv = findList(root);
        waitFor("messages loaded", () -> lv.getAdapter().getCount() >= 4); // day label + 3 messages
        boolean sawUpi = false, sawPhoto = false;
        for (int i = 0; i < lv.getAdapter().getCount(); i++) {
            View v = lv.getAdapter().getView(i, null, lv);
            if (findText(v, "UPI: ravi@ybl") != null) sawUpi = true;
            ChatActivity.Msg m = (ChatActivity.Msg) lv.getAdapter().getItem(i);
            if ("FILE1".equals(m.fileId)) sawPhoto = true;
        }
        assertTrue(sawUpi);
        assertTrue(sawPhoto);
        { // Long-press a message copies its text (both apps)
            for (int i = 0; i < lv.getAdapter().getCount(); i++) {
                View v = lv.getAdapter().getView(i, null, lv);
                TextView upi = findText(v, "UPI: ravi@ybl");
                if (upi != null) { assertTrue(upi.performLongClick()); break; }
            }
            android.content.ClipboardManager cm = (android.content.ClipboardManager) chat.getSystemService(android.content.Context.CLIPBOARD_SERVICE);
            assertEquals("UPI: ravi@ybl", cm.getPrimaryClip().getItemAt(0).getText().toString());
            assertEquals("Copy ho gaya ✅", org.robolectric.shadows.ShadowToast.getTextOfLatestToast());
        }
        waitFor("image requested", () -> server.log.stream().anyMatch(s -> s.startsWith("GET /api/telegram-file?file_id=FILE1")));
        // Send text
        EditText input = null;
        for (TextView t : texts(root)) if (t instanceof EditText) input = (EditText) t;
        input.setText("Funds bhej diye, trade kariye");
        findText(root, "➤").performClick();
        waitFor("text sent", () -> server.sentTexts.size() == 1);
        assertEquals("111", server.sentTexts.get(0).getString("chatId"));
        assertEquals("Funds bhej diye, trade kariye", server.sentTexts.get(0).getString("text"));
        assertEquals("", input.getText().toString());
        waitFor("sent message appears", () -> { for (int i = 0; i < lv.getAdapter().getCount(); i++) { ChatActivity.Msg m = (ChatActivity.Msg) lv.getAdapter().getItem(i); if (!m.pending && "Funds bhej diye, trade kariye".equals(m.text)) return true; } return false; });
        // Send photo
        android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(40, 30, android.graphics.Bitmap.Config.ARGB_8888);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out);
        Uri uri = Uri.parse("content://test/photo.png");
        // the activity opens the stream twice (bounds, then pixels)
        final byte[] bytes = out.toByteArray();
        shadowOf(chat.getContentResolver()).registerInputStreamSupplier(uri, () -> new ByteArrayInputStream(bytes));
        input.setText("Ye screenshot dekho");
        chat.onActivityResult(7, android.app.Activity.RESULT_OK, new Intent().setData(uri));
        waitFor("photo confirm dialog", () -> ShadowAlertDialog.getLatestDialog() != null && ShadowAlertDialog.getLatestDialog().isShowing());
        AlertDialog pd = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        pd.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        waitFor("photo sent", () -> server.sentPhotos.size() == 1);
        JSONObject p = server.sentPhotos.get(0);
        assertEquals("111", p.getString("chatId"));
        assertEquals("image/jpeg", p.getString("mimeType"));
        assertEquals("Ye screenshot dekho", p.getString("caption"));
        assertTrue(p.getString("imageBase64").length() > 50);
        cc.pause().stop().destroy();
    }

    @Test public void replyMovesChatToTop_andMonthFilter() throws Exception {
        loginSession("Rahul");
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        View root = c.get().getWindow().getDecorView();
        ListView lv = findList(root);
        waitFor("list loaded", () -> lv.getAdapter().getCount() > 0);
        assertEquals(List.of("Ravi", "Sofiya", "Anu"), rowNames(lv));
        // "Is mahine" keeps users whose last message is in this IST month
        findText(root, "Filter").performClick();
        AlertDialog d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        RadioGroup what = null, when = null;
        for (View v : allViews(d.getWindow().getDecorView())) if (v instanceof RadioGroup) { if (what == null) what = (RadioGroup) v; else when = (RadioGroup) v; }
        assertEquals(5, when.getChildCount());
        assertEquals("Is mahine", ((RadioButton) when.getChildAt(4)).getText().toString());
        ((RadioButton) when.getChildAt(4)).setChecked(true);
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertTrue(rowNames(lv).contains("Ravi"));
        findText(root, "✕ hatao").performClick();
        c.pause();
        // Reply to Anu (3rd) from the chat, come back: Anu is first at once
        Intent in = new Intent(ctx, ChatActivity.class).putExtra("id", "222").putExtra("name", "Anu").putExtra("tradeStatus", "");
        ActivityController<ChatActivity> cc = Robolectric.buildActivity(ChatActivity.class, in).setup();
        View cr = cc.get().getWindow().getDecorView();
        EditText input = null;
        for (TextView t : texts(cr)) if (t instanceof EditText) input = (EditText) t;
        input.setText("Hello Anu");
        findText(cr, "➤").performClick();
        waitFor("sent", () -> server.sentTexts.size() == 1);
        waitFor("send confirmed", () -> Api.lastSent.containsKey("222"));
        cc.pause().stop().destroy();
        c.resume();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals("Anu", rowNames(lv).get(0));
        View row = lv.getAdapter().getView(0, null, lv);
        assertNotNull(findText(row, "You: Hello Anu"));
        c.pause().stop().destroy();
    }

    @Test public void payment_sendsScreenshotAndCampaignMessage_movesToPaymentTab() throws Exception {
        loginSession("Rahul");
        Intent in = new Intent(ctx, ChatActivity.class).putExtra("id", "111").putExtra("name", "Ravi").putExtra("tradeStatus", "");
        ActivityController<ChatActivity> cc = Robolectric.buildActivity(ChatActivity.class, in).setup();
        ChatActivity chat = cc.get();
        View root = chat.getWindow().getDecorView();
        findText(root, "💰 Payment").performClick();
        waitFor("templates loaded + picker opened", () -> server.log.contains("GET /api/trade-templates") && shadowOf(chat).peekNextStartedActivity() != null);
        Intent picker = shadowOf(chat).getNextStartedActivity();
        assertEquals(Intent.ACTION_CHOOSER, picker.getAction());
        android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(60, 40, android.graphics.Bitmap.Config.ARGB_8888);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out);
        final byte[] bytes = out.toByteArray();
        Uri uri = Uri.parse("content://test/payment.png");
        shadowOf(chat.getContentResolver()).registerInputStreamSupplier(uri, () -> new ByteArrayInputStream(bytes));
        chat.onActivityResult(8, android.app.Activity.RESULT_OK, new Intent().setData(uri));
        waitFor("payment confirm dialog", () -> ShadowAlertDialog.getLatestDialog() != null && ShadowAlertDialog.getLatestDialog().isShowing() && findText(ShadowAlertDialog.getLatestDialog().getWindow().getDecorView(), "Search Share name") != null);
        ((AlertDialog) ShadowAlertDialog.getLatestDialog()).getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        waitFor("payment sent", () -> server.paymentCalls.size() == 1);
        JSONObject p = server.paymentCalls.get(0);
        assertEquals("111", p.getString("chatId"));
        assertEquals("choice", p.getString("template"));
        assertEquals("Rahul", p.getString("by"));
        assertEquals("image/jpeg", p.getString("mimeType"));
        assertTrue(p.getString("imageBase64").length() > 50);
        waitFor("status shown", () -> findText(root, "💰 Payment bheja · Choice · Rahul") != null);
        assertNotNull("Done still possible after payment", findText(root, "✅ Done"));
        cc.pause().stop().destroy();
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        View lroot = c.get().getWindow().getDecorView();
        ListView lv = findList(lroot);
        waitFor("list loaded", () -> lv.getAdapter().getCount() > 0);
        assertFalse("not in TQ any more", rowNames(lv).contains("Ravi"));
        findText(lroot, "Payment").performClick();
        assertEquals(List.of("Ravi"), rowNames(lv));
        View row = lv.getAdapter().getView(0, null, lv);
        assertNotNull(findText(row, "💰 Payment bheja · Choice · Rahul"));
        c.pause().stop().destroy();
    }

    @Test public void dateFilter_defaultIsThisMonth() throws Exception {
        loginSession("Rahul");
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        View root = c.get().getWindow().getDecorView();
        waitFor("list loaded", () -> findList(root).getAdapter().getCount() > 0);
        findText(root, "Filter").performClick();
        AlertDialog d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        RadioGroup what = null, when = null;
        for (View v : allViews(d.getWindow().getDecorView())) if (v instanceof RadioGroup) { if (what == null) what = (RadioGroup) v; else when = (RadioGroup) v; }
        assertTrue("Is mahine selected by default", ((RadioButton) when.getChildAt(4)).isChecked());
        assertEquals("Filter", findText(root, "Filter").getText().toString());
        c.pause().stop().destroy();
    }

    @Test public void expiredSession_goesToLogin() throws Exception {
        ctx.getSharedPreferences("aisha_team", Context.MODE_PRIVATE).edit().putString("cookie", "expired").apply();
        Api.setMemberName(ctx, "Rahul");
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        waitFor("login opened", () -> { Intent n = shadowOf(c.get()).peekNextStartedActivity(); return n != null && n.getComponent().getClassName().equals(LoginActivity.class.getName()); });
        assertFalse(Api.hasSession(ctx));
    }

    @Test public void missingMemberName_isAsked() throws Exception {
        ctx.getSharedPreferences("aisha_team", Context.MODE_PRIVATE).edit().putString("cookie", FakeServer.TOKEN).apply();
        ActivityController<ListActivity> c = Robolectric.buildActivity(ListActivity.class).setup();
        AlertDialog d = (AlertDialog) ShadowAlertDialog.getLatestDialog();
        assertNotNull("name dialog", d);
        EditText et = null;
        for (View v : allViews(d.getWindow().getDecorView())) if (v instanceof EditText) et = (EditText) v;
        et.setText("Priya");
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals("Priya", Api.memberName(ctx));
        c.pause().stop().destroy();
    }

    private static List<View> allViews(View v) {
        List<View> out = new ArrayList<>();
        out.add(v);
        if (v instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) v).getChildCount(); i++) out.addAll(allViews(((ViewGroup) v).getChildAt(i)));
        return out;
    }
}
