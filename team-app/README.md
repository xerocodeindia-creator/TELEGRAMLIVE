# Team Dhruv / Aarohi Team (Android)

One code, two apps (Gradle flavors): **aisha** = Team Dhruv (`com.aisha.team`, Aisha server, unchanged) and **aarohi** = Aarohi Team (`com.aarohi.team`, `https://telegramlive.vercel.app`, pink icon, filters Angel One / Choice FinX / Bajaj). Both can be installed on the same phone.

Native Android app for the Aisha team: the **Trade Qualified** list only, to help users with the trade.
Package `com.aisha.team`. Talks to the Aisha dashboard server (`https://aisha-dashboard-black.vercel.app`) with the same login.

## What it does
- **Login** with the dashboard password + the team member's name (saved on the phone, shown on every status change).
- **Tabs:** TQ / Payment / Done / Not Int, with counts. List sorted by the last message, refreshes every 4 s.
- **Filter** (one dialog): Sab / Unread / Bonus 1 / Bonus 2 / Choice / HDFC / Bajaj, and date Sab / Aaj / Kal / 3 din / Is mahine (default).
- **Chat:** messages and photos (tap = full screen), send text, send photo with caption, call the user.
- **💰 Payment:** pick the campaign (from `/api/trade-templates`), pick the payment screenshot → `/api/trade-payment` sends the screenshot and the campaign message and moves the user to **Payment**.
- **✅ Done / 🚫 Not int / ↩ TQ:** `/api/trade-status`.

Server routes used (Aisha only, in this repo under `src/app/api/`): `auth`, `tq`, `messages`, `manual-reply`, `send-photo`, `telegram-file`, `trade-status`, `trade-payment`, `trade-templates`.
Campaign messages live in `src/lib/trade-templates.ts` — adding a campaign needs no new APK.

## Build
Needs JDK 17+ and the Android SDK (platform 34, build-tools 34.0.0). Create `local.properties` with `sdk.dir=/path/to/android-sdk`.

```bash
./gradlew testAishaReleaseUnitTest testAarohiReleaseUnitTest   # 10 Robolectric tests each, against a fake server (src/test)
./gradlew assembleAishaRelease    # Team Dhruv  → app/build/outputs/apk/aisha/release/
./gradlew assembleAarohiRelease   # Aarohi Team → app/build/outputs/apk/aarohi/release/
```

### Signing (not in the repo)
Updates must be signed with the same key, or phones will refuse to install them over the old app.
Keep `aisha-release.jks` and its password outside Git, then:

```bash
export AISHA_KEYSTORE=/path/to/aisha-release.jks
export AISHA_KS_PASS='…'
./gradlew assembleRelease
```

Aarohi Team has its own key: `AAROHI_KEYSTORE` (default `../aarohi-release.jks`, alias `aarohi`) + `AAROHI_KS_PASS`.

Without the key, the release APK is built unsigned. Bump `versionCode` / `versionName` in `app/build.gradle` for every release.
