package com.aisha.team;

import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.widget.ImageView;

/** Full-screen photo (tap to close). */
public class PhotoActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ImageView iv = new ImageView(this);
        iv.setBackgroundColor(0xFF000000);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        iv.setOnClickListener(v -> finish());
        setContentView(iv);
        String fid = getIntent().getStringExtra("fileId");
        Api.image(this, fid, 2048, new Api.Done<Bitmap>() {
            public void ok(Bitmap v) { iv.setImageBitmap(v); }
            public void fail(Exception e) { finish(); }
        });
    }
}
