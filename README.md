# Mushavo Budget

A static recurring personal and family payments tracker powered by Supabase Auth and Postgres. It is designed for users who need to track what must be paid, who is responsible, when it is due, how much has been paid, and what is still outstanding.

## Current Features

- Email/password sign up and sign in
- Installable PWA for phones and desktop browsers
- Protected refresh state with no login-page flash
- URL-aware workspace tabs such as `#family/payments` and `#admin/households`
- Admin dashboard for household health, overdue dues, platform payments, support notes, and access control
- Admin can unlock member access, suspend/reactivate households, and record platform subscription payments
- Actionable dashboard with current dues, overdue items, and next-month payments
- Free accounts can create up to 5 payments
- Personal and family payment scopes
- Recurring payment items for monthly, quarterly, yearly, once-off, and every-N-month payments
- Responsible family member assignment
- Monthly due schedule with upcoming, due soon, overdue, partial, and paid states
- Partial and full payment records with optional private receipt/image/PDF proof
- Member contact fields for email/phone and future reminders
- `Family & Members` workspace with family details and registered-user invitations
- Multiple family workspaces with an admin-controlled family limit
- Family switching and family-specific member invitation dropdowns
- Permanent owner-controlled family deletion with database cascades
- Safe member removal that retains an inactive membership record
- Atomic family creation and invitation accept/reject database functions
- Notification bell with an in-app inbox, unread count, and invitation actions
- Supabase Realtime refreshes visible pages after inserts, updates, and deletes
- Server-triggered Web Push reminders that continue when the PWA is closed
- Per-device Push subscriptions, UTC scheduling, timezone preferences, delivery retries, and duplicate prevention
- Reports by category, payment reliability, active obligations, yearly expected totals, and payment history
- CSV export for the selected month/filter
- Row Level Security policies for households, members, payment items, records, admin notes, and platform payments
- No frontend service role key

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. If you already ran an older version, either run `supabase/migrations/20260828090000_web_push_notifications.sql`, or run the latest complete `supabase/schema.sql` again. The complete schema includes all earlier features plus Web Push subscriptions, reminder outbox records, retries, diagnostics, and RLS policies.
4. In Supabase Auth settings, turn off email confirmation while Resend/email delivery is not configured:
   - Authentication
   - Providers
   - Email
   - Disable `Confirm email`
5. Sign up in the app with the email you want to use as the platform admin.
6. In Supabase SQL Editor, run this once, replacing the email:

```sql
insert into public.app_admins (user_id, email)
select id, lower(email)
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
```

7. Sign out and sign back in. You should now see the admin dashboard.
8. In Supabase Auth settings, add your local and GitHub Pages URLs to allowed redirect URLs:
   - `http://localhost:8000`
   - `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/`
9. Open `config.js` and set your publishable Supabase details:

```js
window.MUSHAVO_BUDGET_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabasePublishableKey: "YOUR-SUPABASE-PUBLISHABLE-KEY",
  vapidPublicKey: "YOUR_VAPID_PUBLIC_KEY"
};
```

The VAPID public key is designed to be public. Use the Supabase publishable key only. Never put the VAPID private key, `CRON_SECRET`, Supabase service role key, or any other server secret in frontend code.

## How Access Works

Anyone can sign up for free and sign in immediately. Free users can create up to 5 personal payments.

Creating a family requires an active membership. The admin controls the maximum number of families the user may own with `family_limit`. A limit of `0` blocks family creation, `1` allows one family, and larger values allow additional families. Platform payment status is not used for this permission.

Only the owner of a family with an active membership and `can_add_members = true` can invite or remove members. The invitation form includes a family dropdown so the owner chooses which owned family the person should join. Family creation, deletion, invitation creation, notification creation, member removal, and invitation responses are handled by protected database functions so the rules cannot be bypassed from the browser.

Invited users do not need an active membership or subscription to join a family. They only need a registered Mushavo Budget login matching the invited email, then they can accept or reject the invitation from `Family & Members`.

Family members must register with Mushavo Budget before they can be invited. If an email has not registered yet, the inviter sees a friendly message asking that person to sign up first.

Removing a member sets their membership record to `inactive`; it does not delete that record. The family owner cannot remove themselves. Reinviting the same registered email can reactivate the retained membership after the user accepts.

Deleting a family is different from removing a member. Only the family owner can delete their family. The family row is permanently deleted from the database, and foreign-key cascades remove its operational family data. The owner's subscription/access row remains so the admin-controlled family limit continues to apply and the owner can create another family if a slot is available.

## Main Household Workflow

1. Sign up, then sign in.
2. Add up to 5 personal payments on the free account.
3. Ask the platform admin to activate your membership and set your family limit.
4. Create a family and add its name, monthly budget, and currency from `Family & Members`.
5. If the admin grants more family slots, create additional families and switch between them from the family selector.
6. Invite registered users by choosing the target family, entering their email, and selecting their role. Members cannot be added manually.
7. The invited user signs in and accepts or rejects the notification from `Family & Members`.
8. Add recurring payments:
   - payment name
   - amount
   - category
   - responsible member
   - recurrence
   - due day
   - reminder days
9. Use `Dashboard` to see what is due now and what is coming next month.
10. Open a due item and record either a partial or full payment. Optionally attach a JPG, PNG, WebP, or PDF receipt up to 10 MB, or add payment details.
11. Use `Reports` to review paid rate, outstanding dues, category totals, and history.

## Reminder Architecture

### Root cause of the old failure

The earlier code called `Notification.requestPermission()` and created `new Notification(...)` objects only from reminder occurrences loaded in the dashboard. It did not create a Push API subscription, did not save a device endpoint, had no server scheduler or delivery queue, and the service worker had no `push` or `notificationclick` handler. Once the page was suspended or closed, no JavaScript remained alive to notice that a reminder was due.

The new flow does not use browser timers as a scheduler:

1. Payment reminder definitions remain in `payment_items`.
2. Each user stores a timezone and local reminder time. `Africa/Harare` is the default.
3. Supabase Cron calls `send-reminders` every minute.
4. The database expands due recurring occurrences and stores their `scheduled_for` and `due_at` values as UTC `timestamptz` values.
5. A unique occurrence/user key creates one outbox row and one in-app bell notification.
6. The Edge Function sends Web Push to every active subscription for that user.
7. Per-device delivery attempts retry temporary failures. HTTP 404/410 disables expired endpoints.
8. The existing service worker receives the push, shows the operating-system notification, and opens or focuses the relevant Mushavo Budget screen when tapped.

### Generate VAPID keys

Run this once on a trusted computer. Keep the private key secret.

```bash
npx web-push generate-vapid-keys --json
```

Copy the returned public key into `config.js`. Do not copy the private key into any website file.

### Configure Edge Function secrets

Generate a separate long random cron secret, for example:

```bash
openssl rand -base64 48
```

Then configure and deploy with the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="YOUR_VAPID_PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:YOUR-CONTACT-EMAIL@example.com"
supabase secrets set CRON_SECRET="YOUR_LONG_RANDOM_CRON_SECRET"
supabase functions deploy send-reminders --no-verify-jwt
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to deployed Supabase Edge Functions automatically. The function uses the service role only on the server. Never copy it into `config.js`, the cron SQL, or browser storage.

### Apply the database migration

Choose one method:

```bash
supabase db push
```

Or paste the complete `supabase/schema.sql` into Supabase SQL Editor. For an existing database, the smaller `supabase/migrations/20260828090000_web_push_notifications.sql` contains only this Web Push upgrade.

### Enable the one-minute Cron job

1. Open `supabase/cron.sql`.
2. Replace `YOUR_PROJECT_REF` and `REPLACE_WITH_THE_SAME_LONG_RANDOM_CRON_SECRET`.
3. The cron secret must exactly match the Edge Function `CRON_SECRET`.
4. Run the complete file in Supabase SQL Editor.
5. Confirm the job and recent dispatch heartbeats:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'mushavo-push-reminders-every-minute';

select started_at, completed_at, status, due_count, attempted_count, accepted_count, diagnostic_code
from public.notification_dispatch_runs
order by started_at desc
limit 10;
```

If no new dispatch run appears for more than two minutes, the cron is not reaching the function. Check `cron.job_run_details`, the Vault values, the deployed function name, and the function logs.

### Notification settings and privacy

Permission is requested only after the user presses `Enable notifications`. The settings page shows Notification API, Push API, service-worker, permission, and database-subscription status. Users can turn scheduled reminders on/off, select their timezone, choose their local reminder time, enable detailed previews, send a test, or disable only the current device.

Privacy-safe previews are the default and do not show payment names or amounts. Detailed previews may show a payment name, but still do not include an amount. The in-app bell keeps the full reminder record under authenticated RLS access.

On iPhone and iPad, install Mushavo Budget with Share → Add to Home Screen, open that installed app, then press `Enable notifications`. Web Push is not offered from a normal iOS browser tab.

### Required acceptance tests

Use a real HTTPS deployment. Browser Push cannot be fully proven by static code checks alone.

1. Sign in, open Settings, and press `Enable notifications`. Confirm the permission status becomes Allowed and the device becomes Subscribed.
2. In Supabase SQL Editor, confirm the signed-in user has one active row without displaying key values:

```sql
select id, user_id, platform, created_at, updated_at, last_used_at, disabled_at
from public.push_subscriptions
where disabled_at is null;
```

3. Press `Send test notification`; confirm it appears while the app is open and in the bell.
4. Send another test with the app in the background.
5. Send another test after completely closing the installed PWA.
6. For a two-minute scheduled test, set the Settings reminder time to two minutes from now, create a once-off payment due today with `Remind days before = 0`, then completely close the PWA.
7. Tap the delivered notification. Confirm it opens/focuses Mushavo Budget on Payments and highlights the matching payment.
8. Confirm the bell contains one matching reminder record.
9. Wait through at least two more cron minutes and confirm the same occurrence did not send again:

```sql
select deduplication_key, count(*)
from public.notification_outbox
group by deduplication_key
having count(*) > 1;
```

The query must return no rows.

10. Enable notifications on a second device for the same user. Send a test and confirm both devices receive it.
11. Sign in as another user and verify the API/Settings view cannot list, update, or delete the first user's subscription. RLS policies bind all four operations to `auth.uid()`.
12. Set timezone to `Africa/Harare`, schedule a test occurrence, and confirm the stored UTC time converts back correctly:

```sql
select scheduled_for,
       scheduled_for at time zone timezone as selected_local_time,
       timezone
from public.notification_outbox
order by created_at desc
limit 10;
```

13. Block notifications in browser settings and confirm Settings shows recovery instructions rather than failing silently.
14. Repeat install, enable, background, closed-app, and tap-through tests on Android Chrome as an installed PWA.
15. On iOS/iPadOS 16.4 or later, confirm a normal Safari tab explains that Home Screen installation is required, then repeat the tests from the installed Home Screen PWA.
16. Disable notifications on the current device and confirm its row receives `disabled_at` and that other subscribed devices continue to receive tests.

### Diagnostic codes

Frontend console messages are prefixed with `[Mushavo Push]`. Edge Function logs use JSON with `scope: "mushavo-push"`. They distinguish unsupported APIs, service-worker failures, permission state, missing/saved subscriptions, database save failures, authentication failures, no due reminders, provider rejection, successful acceptance, expired subscriptions, and duplicate skips. Logs never contain endpoints, Push authentication keys, VAPID private keys, access tokens, cron secrets, or payment amounts.

## Admin Workflow

1. Open Admin `Dashboard` to see household health.
2. Open `Households` to unlock member access, suspend/reactivate households, and see overdue/partial dues.
3. Open `Users` to manually configure a household owner.
4. Open `Finance` to record platform subscription payments.
5. Open `Support` to add household support notes.

## Run Locally

From this folder:

```bash
python -m http.server 8000
```

If Python is not installed, use any static file server.

Then open `http://localhost:8000`.

## Install On Phone

After the site is published on GitHub Pages, open it on your phone:

- Android Chrome: open the site and use the `Install app` button in `Settings`, or tap the browser menu and choose `Install app` / `Add to Home screen`.
- iPhone Safari: open the site, tap Share, then tap `Add to Home Screen`. iOS Safari does not show the same automatic install prompt that Android Chrome does.

PWA installation requires HTTPS. GitHub Pages provides HTTPS.

## Upload To GitHub

Upload all visible files and folders, including:

- `index.html`
- `signup.html`
- `app.js`
- `styles.css`
- `config.js`
- `manifest.webmanifest`
- `sw.js`
- `offline.html`
- `README.md`
- `RECURRING_PAYMENTS_PLAN.md`
- `supabase/schema.sql`
- `supabase/migrations/20260828090000_web_push_notifications.sql`
- `supabase/functions/send-reminders/index.ts`
- `supabase/functions/.env.example`
- `supabase/config.toml`
- `supabase/cron.sql`
- `assets/ledger-mark.svg`
- `assets/pwa-icon.svg`

If you use Git from the terminal:

```bash
git init
git add .
git commit -m "Build recurring family payments tracker"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```
