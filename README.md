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
- In-app payment reminders in the notification bell and inbox
- Reports by category, payment reliability, active obligations, yearly expected totals, and payment history
- CSV export for the selected month/filter
- Row Level Security policies for households, members, payment items, records, admin notes, and platform payments
- No frontend service role key

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. If an earlier Web Push build was deployed, run `supabase/rollback-web-push.sql` once before running the current complete schema.
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
  supabasePublishableKey: "YOUR-SUPABASE-PUBLISHABLE-KEY"
};
```

Use the Supabase publishable key only. Never place the Supabase service-role key or any other server secret in frontend code.

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

## In-App Reminders

The notification bell and Settings inbox show invitations and payment reminders while the user is signed in. Web Push subscriptions, background delivery, VAPID keys, the reminder Edge Function, and the one-minute Cron job are not part of this version.

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

- Android Chrome: open the site, tap the browser menu, and choose `Install app` or `Add to Home screen`.
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
- `supabase/rollback-web-push.sql` (only needed if the removed Web Push version was previously deployed)
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
