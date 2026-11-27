package com.aisha.team;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class LoginActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        int pad = Ui.dp(this, 24);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(Ui.BG);

        TextView title = Ui.text(this, BuildConfig.APP_TITLE, 26, Ui.TEXT, true);
        title.setGravity(Gravity.CENTER);
        TextView sub = Ui.text(this, BuildConfig.IS_AAROHI ? "Team member: naam + team password\nAdmin: admin password" : "Team login — dashboard wala password", 14, Ui.MUTED, false);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, Ui.dp(this, 6), 0, Ui.dp(this, 24));

        EditText member = new EditText(this);
        member.setHint("Aapka naam (team member)");
        member.setHintTextColor(Ui.MUTED);
        member.setTextColor(Ui.TEXT);
        member.setSingleLine(true);
        member.setText(Api.memberName(this));
        member.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 12)));
        member.setPadding(Ui.dp(this, 16), Ui.dp(this, 14), Ui.dp(this, 16), Ui.dp(this, 14));

        EditText pass = new EditText(this);
        pass.setHint("Password");
        pass.setHintTextColor(Ui.MUTED);
        pass.setTextColor(Ui.TEXT);
        pass.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pass.setImeOptions(EditorInfo.IME_ACTION_DONE);
        pass.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 12)));
        pass.setPadding(Ui.dp(this, 16), Ui.dp(this, 14), Ui.dp(this, 16), Ui.dp(this, 14));

        TextView err = Ui.text(this, "", 14, 0xFFFF7A7A, false);
        err.setPadding(0, Ui.dp(this, 10), 0, 0);

        Button go = new Button(this);
        go.setText("Login");
        go.setTextColor(0xFFFFFFFF);
        go.setAllCaps(false);
        go.setTextSize(16);
        go.setBackground(Ui.round(Ui.OUT, Ui.dp(this, 12)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, Ui.dp(this, 52));
        lp.topMargin = Ui.dp(this, 16);

        Runnable submit = () -> {
            String p = pass.getText().toString();
            String who = member.getText().toString().trim();
            if (who.isEmpty()) { err.setText("Apna naam daaliye"); return; }
            if (p.isEmpty()) { err.setText("Password daaliye"); return; }
            Api.setMemberName(this, who);
            go.setEnabled(false); go.setText("Login ho raha…"); err.setText("");
            Api.login(this, p, who, new Api.Done<Boolean>() {
                public void ok(Boolean v) {
                    Class<?> next = Api.isMaster(LoginActivity.this) ? AdminActivity.class : ListActivity.class;
                    startActivity(new Intent(LoginActivity.this, next).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)); finish();
                }
                public void fail(Exception e) { go.setEnabled(true); go.setText("Login"); err.setText(e.getMessage() == null ? "Login failed" : e.getMessage()); }
            });
        };
        go.setOnClickListener(v -> submit.run());
        pass.setOnEditorActionListener((v, id, ev) -> { submit.run(); return true; });

        root.addView(title, new LinearLayout.LayoutParams(-1, -2));
        root.addView(sub, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(-1, -2); mlp.bottomMargin = Ui.dp(this, 12);
        root.addView(member, mlp);
        root.addView(pass, new LinearLayout.LayoutParams(-1, -2));
        root.addView(go, lp);
        root.addView(err, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
    }
}
