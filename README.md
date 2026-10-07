# Northhill Kids Club – parents & staff portal

A website for the Northhill Kids Club where parents register their children and
follow their subscription, and club staff manage payments and attendance.

White background and orange as the main color. It's built with React + Vite on Firebase
(Authentication and Cloud Firestore) and hosted on **GitHub Pages**:
<https://maxtcwebsites.github.io/nhclub/>. Firebase Hosting works too.

## What each account can do

| | Parent | Teacher | Super admin (`r45t6er7@gmail.com`) |
|---|:-:|:-:|:-:|
| Create an account (email/password or Google) | ✅ | ✅ (starts as a parent) | ✅ |
| Register children, edit their details | ✅ own | ✅ all | ✅ all |
| See paid-until date, payment history, attendance | ✅ own | ✅ all | ✅ all |
| Record payments (amount + number of months) | ❌ | ✅ | ✅ |
| Corrections / refunds (with a required reason) | ❌ | ✅ | ✅ |
| Dashboard sorted by expiring subscription | ❌ | ✅ | ✅ |
| Attendance calendar with notes | ❌ (read only) | ✅ | ✅ |
| Activity log for every student | ❌ | ✅ | ✅ |
| Promote a parent account to teacher / remove it | ❌ | ❌ | ✅ |
| Club settings (absence policy, fee, club days…) | ❌ | ❌ | ✅ |

**How someone becomes a teacher:** they create a normal parent account, then
the super admin opens **Users** and presses **Make teacher**. The change takes
effect immediately, and removing it does too.

**Absence policy (super admin setting):** by default, skipping a day doesn't
change anything ("absences are still charged"). The super admin can change it
so that *excused* absences, or *all* absences, add one free day to an active
subscription. Credited days are shown to parents and recorded in the log.

## How billing works

* Each payment records **amount, number of months, method and start date**.
  The new *paid-until* date is `start + months − 1 day`. By default the start
  is the day after the current period ends, or today if it has already
  expired.
* Status shown everywhere: **Paid**, **Expiring soon** (within N days, set in
  settings), **Expired**, **Not paid yet**, **Archived**.
* Payments can never be edited or deleted. A mistake is fixed with a
  **Correction**, which sets a new paid-until date and optionally an amount (it
  can be negative for a refund) and a month change, together with a reason. The
  original entry stays in the history.

---

## 1. One-time Firebase console setup

Open <https://console.firebase.google.com/project/nhclub-1260c>.

1. **Authentication → Sign-in method**: enable **Email/Password** and
   **Google**.
2. **Firestore Database → Create database**: choose *production mode* and a
   region close to the club. You can't change the region later.
3. **Firestore rules**: copy the whole [`firestore.rules`](firestore.rules)
   file into *Firestore Database → Rules* and press **Publish**, or run
   `npx firebase login` and then `npm run deploy:rules`. GitHub Pages only
   hosts the website. The rules always live in Firebase, so publish them
   again whenever `firestore.rules` changes.
4. **Authentication → Settings → Authorized domains**: press *Add domain* and
   add **`maxtcwebsites.github.io`**. Without it, *Continue with Google*
   fails on the GitHub Pages site. Add your own domain too if you connect one.
5. **Authentication → Templates**: set the sender name and the email text to
   say "Northhill Kids Club". Parents get these emails to confirm their
   address and to reset their password.

## 2. Run it locally

```bash
npm install
npm run dev          # http://localhost:5173, talks to the real Firebase project
```

To work fully offline against local emulators (needs Java 11+):

```bash
npm run emulators            # terminal 1
npm run dev:emulators        # terminal 2
```

## 3. Deploy to GitHub Pages

One-time setup on GitHub:

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**. Don't
   pick "Deploy from a branch": that would publish the raw source code, and
   the site would show a blank page.
3. Tick **Enforce HTTPS** if it's shown.

After that, every push to `claude/northhill-kids-club` (or `main`) runs
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
It runs the security-rules tests, builds the site, and publishes it to
<https://maxtcwebsites.github.io/nhclub/> **only if the tests pass**. You
can also start it by hand: open **Actions → Deploy to GitHub Pages → Run
workflow**.

Pages are addressed with `#`, for example
`https://maxtcwebsites.github.io/nhclub/#/family`. That's what lets every page
work on a static host. Old-style links without the `#` are redirected
automatically.

### Alternative: Firebase Hosting

The same build also works on Firebase Hosting, which can send the full set of
security headers from `firebase.json`:

```bash
npx firebase login
npm run deploy        # builds and deploys hosting + Firestore rules
```

That site would be at <https://nhclub-1260c.web.app>.

## 4. First sign-in as super admin

Sign in with **Continue with Google** using `r45t6er7@gmail.com`. Google
accounts are verified automatically. If you sign up with email and password
instead, you have to click the confirmation link first. Super-admin powers
only work once the email is **verified**, so nobody else can register that
address and take over.

Then:

1. Open **Settings**, check the monthly fee, the absence policy and the club
   days, and press **Save**.
2. Ask each teacher to create an account, then go to **Users → Make teacher**.

To use a different super-admin email, change it in **both**
`src/config.js` and `firestore.rules` (the `isSuperAdmin()` function), then
redeploy.

---

## Security

### Firestore rules ([`firestore.rules`](firestore.rules))

* **Deny by default.** Only the collections the app uses are open, and only
  for the exact operations it needs.
* **Verified email required.** Except for creating or reading your own
  profile, every request needs a signed-in user whose email is verified.
* **Roles live on the server.** Everyone is created as `parent`. A user can
  never change their own role. Only the super admin can set `teacher`, and
  the super admin is recognised by the *verified* email in the Firebase Auth
  token, not by anything the browser sends.
* **Parents only ever see their own family.** They can read their own
  children, payments and attendance. They can't read other families, the
  users list or the logs.
* **Parents can't touch money.** A child is always created with no payment,
  and parents can only change the profile fields (name, allergies, contacts…).
* **Strict schemas.** Every write must contain exactly the allowed fields,
  with the right types and length limits. Unknown fields are rejected. Dates
  must look like `YYYY-MM-DD`.
* **Server timestamps only.** Records can't be back-dated.
* **Money in integer cents.** This avoids rounding errors.
* **Ledger integrity.** A student's paid-until date and totals can only change
  together with a *new* ledger entry in the same batch, and the rules check
  that the totals add up exactly. The entry must also record the previous
  values, which blocks stale or concurrent overwrites.
* **Append-only payments and logs.** No one can edit or delete them from the
  app, including the super admin.
* **Every change is logged.** Every change to a student (registration, edits,
  payments, corrections, attendance, archiving) and every role or settings
  change must be committed together with a new audit-log entry whose author is
  the real caller with their real role.
* **Absence credit follows policy.** A day can only be credited when the
  server-side absence policy allows it, and the credit counter can only move
  together with an attendance record.

These rules are covered by an automated test suite with 47 tests
([`tests/rules.test.js`](tests/rules.test.js)). It runs the app's real write
code against the Firestore emulator and tries the tricks a curious user could
attempt from the browser console:

```bash
npm test     # needs Java 11+; starts the emulator, runs the tests, stops it
```

### Website

* A strict **Content-Security-Policy** only allows scripts, styles and
  connections from this site, Firebase and Google. GitHub Pages can't send
  custom headers, so the build puts the same policy into a `<meta>` tag in
  `index.html`. [`firebase.json`](firebase.json) is the single source for it.
* **Clickjacking protection.** The app refuses to load inside another
  website's frame.
* **HTTPS only.** All of `github.io` is on the browsers' HSTS preload list,
  and **Enforce HTTPS** should be on in the Pages settings.
* On Firebase Hosting, the site also sends HSTS, `X-Frame-Options: DENY`,
  `nosniff`, `Permissions-Policy` and `Referrer-Policy` headers.
* Staff accounts are **signed out after 30 minutes** of inactivity
  (`src/config.js`).
* Login errors never reveal whether an email is registered. The password
  reset page always gives the same answer.
* Passwords need at least 8 characters with letters and numbers.
* Redirects after login only go to pages inside the site.
* Search engines only see the public landing page. Every other page is behind
  sign-in and sits behind a `#` address, which crawlers don't index as a
  separate page.

### Recommended extra hardening (Firebase / Google Cloud console)

1. **Turn on 2-Step Verification** for the `r45t6er7@gmail.com` Google
   account and always use *Continue with Google*. That account controls
   everything.
2. **Restrict the API key**: Google Cloud console → *APIs & Services →
   Credentials* → the "Browser key". Under *Website restrictions*, allow only
   `https://maxtcwebsites.github.io/*`, `https://nhclub-1260c.web.app/*`,
   `https://nhclub-1260c.firebaseapp.com/*`, `http://localhost:5173/*` and
   your own domain. The key is public by design,
   but this stops other websites from using it.
3. **App Check**: create a reCAPTCHA v3 key, register it in *Firebase → App
   Check* (add the domain `maxtcwebsites.github.io` to the key). Then, on
   GitHub, open **Settings → Secrets and variables → Actions → Variables** and
   add `VITE_RECAPTCHA_SITE_KEY` with the site key. For local runs, put it in
   `.env.local` instead. Push or re-run the workflow, check that the site
   works, then press **Enforce** for Cloud Firestore. After that, only
   your website can talk to the database.
4. **Authentication → Settings**: keep **Email enumeration protection** on,
   and set a **password policy** (minimum length 8 or more).
5. Set a **budget alert** under Google Cloud billing.

### Notes

* `npm audit` flags `@grpc/grpc-js` through `firebase`. That package is only
  used by Firestore's Node.js build and isn't part of the website bundle. The
  other findings are in development tools (`firebase-tools`).
* Google Analytics (page views only) is on, as in the original Firebase
  snippet. Set `ENABLE_ANALYTICS = false` in `src/config.js` if you don't want
  it. Depending on where the club is, you might need a cookie notice.

---

## Project structure

```
firestore.rules          Security rules (the important part)
.github/workflows/       GitHub Pages: test, build and deploy on every push
firebase.json            Security headers / CSP, Firebase Hosting, emulators
public/404.html          Redirects old-style links to the #/ address on GitHub Pages
src/config.js            Super-admin email, club name, idle timeout
src/firebase.js          Firebase initialisation
src/lib/api.js           Every database write (shaped to match the rules)
src/lib/billing.js       Subscription / expiry logic
src/lib/dates.js         Date helpers (YYYY-MM-DD strings)
src/context/             Auth, settings and toast providers
src/pages/auth/          Sign in, sign up, verify email, reset password
src/pages/parent/        My family, add/edit child, child page
src/pages/staff/         Dashboard, student page, attendance, activity log
src/pages/admin/         Users & teachers, club settings
tests/rules.test.js      Security-rules test suite
```

## Data model

| Collection | Contents | Who can read | Who can write |
|---|---|---|---|
| `users/{uid}` | name, email, phone, role | the user and staff | the user (name and phone only); super admin (role only) |
| `students/{id}` | child profile, `parentUid`, `paidUntil`, totals, `creditDays` | the parent and staff | parent (profile only); staff |
| `payments/{id}` | append-only ledger: amount (cents), months, period, method, author | the parent and staff | staff (create only) |
| `attendance/{studentId_date}` | present / absent / excused, note, `credited` | the parent and staff | staff |
| `logs/{id}` | append-only audit trail | staff | created together with each change |
| `settings/club` | club name, currency, monthly fee, absence policy, club days | signed-in users | super admin |
