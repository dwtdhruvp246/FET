# Mushavo Budget

A static recurring personal and family payments tracker powered by Supabase Auth and Postgres. It is designed for users who need to track what must be paid, who is responsible, when it is due, how much has been paid, and what is still outstanding.

## Current Features

- Email/password sign up and sign in
- Installable PWA for phones and desktop browsers
- Protected refresh state with no login-page flash
- URL-aware workspace tabs such as `#family/payments` and `#admin/households`
- Admin dashboard for household health, overdue dues, platform payments, support notes, and access control
- Admin can unlock member access, suspend/reactivate households, and record platform subscription payments
- Simple dashboard with due this month, outstanding, overdue, assigned-to-me, and the payment list
- Free accounts can create up to 5 payments
- Personal and family payment scopes
- Recurring payment items for monthly, quarterly, yearly, once-off, and every-N-month payments
- Responsible family member assignment
- Monthly due schedule with upcoming, due soon, overdue, partial, and paid states
- Partial and full payment records
- Member contact fields for email/phone and future reminders
- `Family & Members` workspace with family details and registered-user invitations
- Atomic family creation and invitation accept/reject database functions
- In-app notifications for invitations and reminder visibility
- Supabase Realtime refreshes visible pages after inserts, updates, and deletes
- In-app reminder visibility and browser notification permission prompt
- Reports by category, payment reliability, active obligations, yearly expected totals, and payment history
- CSV export for the selected month/filter
- Row Level Security policies for households, members, payment items, records, admin notes, and platform payments
- No frontend service role key

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. If you already ran an older version, run the latest `supabase/schema.sql` again. It adds the recurring-payment tables, member contact columns, invitation/notification tables, and enables the app tables in the `supabase_realtime` publication.
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

Use the publishable key only. Never put a Supabase service role or secret key in this frontend.

## How Access Works

Anyone can sign up for free and sign in immediately. Free users can create up to 5 personal payments.

Creating a family is locked until the platform admin gives the user an active family membership with member access enabled. The database checks both `status = active` and `can_add_members = true`; platform payment status is not used for this permission.

Only the owner of a family with that active membership can send invitations. Family creation, invitation creation, notification creation, and invitation responses are handled by protected database functions so the rules cannot be bypassed from the browser.

Invited users do not need an active membership or subscription to join a family. They only need a registered Mushavo Budget login matching the invited email, then they can accept or reject the invitation from `Family & Members`.

Family members must register with Mushavo Budget before they can be invited. If an email has not registered yet, the inviter sees a friendly message asking that person to sign up first.

## Main Household Workflow

1. Sign up, then sign in.
2. Add up to 5 personal payments on the free account.
3. Ask the platform admin to activate family access for your account.
4. Create your family and add its name, monthly budget, and currency from `Family & Members`.
5. Invite registered users by email and role. Members cannot be added manually.
6. The invited user signs in and accepts or rejects the notification from `Family & Members`.
7. Add recurring payments:
   - payment name
   - amount
   - category
   - responsible member
   - recurrence
   - due day
   - reminder days
8. Use `Dashboard` and `Payments` to see what is due this month.
9. Record partial or full payments.
10. Use `Reports` to review paid rate, outstanding dues, category totals, and history.

## Reminder Architecture

This static GitHub Pages app can show in-app reminders and ask for browser notification permission. It cannot send scheduled background emails by itself.

For automatic email reminders later, add:

- Supabase Edge Functions
- Supabase scheduled jobs or cron
- Resend
- Reminder rules stored in Postgres

The current schema already stores reminder timing on payment items so the app is ready for that next step.

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
