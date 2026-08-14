# Household Ledger

A static recurring family payments tracker powered by Supabase Auth and Postgres. It is designed for households that need to track what must be paid, who is responsible, when it is due, how much has been paid, and what is still outstanding.

## Current Features

- Email/password sign up and sign in
- Installable PWA for phones and desktop browsers
- Protected refresh state with no login-page flash
- URL-aware workspace tabs such as `#family/obligations` and `#admin/households`
- Admin dashboard for household health, overdue dues, platform payments, support notes, and access control
- Admin can unlock member access, suspend/reactivate households, and record platform subscription payments
- Household dashboard with due totals, outstanding balance, overdue count, and assigned-to-me count
- Recurring payment items for monthly, quarterly, yearly, once-off, and every-N-month obligations
- Responsible family member assignment
- Monthly due schedule with upcoming, due soon, overdue, partial, and paid states
- Partial and full payment records
- Member contact fields for email/phone and future reminders
- My payments view for members whose login email matches their family member email
- In-app reminder visibility and browser notification permission prompt
- Reports by category, payment reliability, active obligations, yearly expected totals, and payment history
- CSV export for the selected month/filter
- Row Level Security policies for households, members, payment items, records, admin notes, and platform payments
- No frontend service role key

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. If you already ran an older version, run the latest `supabase/schema.sql` again. It adds the recurring-payment tables and member contact columns.
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
window.EXPENSE_TRACKER_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabasePublishableKey: "YOUR-SUPABASE-PUBLISHABLE-KEY"
};
```

Use the publishable key only. Never put a Supabase service role or secret key in this frontend.

## How Access Works

Anyone can sign up and create a household. Free users can create household-level recurring obligations.

Adding additional family members is locked until the platform admin unlocks member access from Admin `Households` or Admin `Users`.

Family members can later sign up with their own email. If their login email matches the email saved on their family member profile, they can read their household and see assigned payments in `My payments`.

## Main Household Workflow

1. Create a household.
2. Ask the platform admin to unlock member access if you need family members.
3. Add family members with email/phone details.
4. Add recurring payment obligations:
   - payment name
   - amount
   - category
   - responsible member
   - recurrence
   - due day
   - reminder days
5. Use `Schedule` to see what is due this month.
6. Record partial or full payments.
7. Use `Reports` to review paid rate, outstanding dues, category totals, and history.

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

- Android Chrome: open the site, tap the menu, then tap `Install app` or `Add to Home screen`.
- iPhone Safari: open the site, tap Share, then tap `Add to Home Screen`.

PWA installation requires HTTPS. GitHub Pages provides HTTPS.

## Upload To GitHub

Upload all visible files and folders, including:

- `index.html`
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
