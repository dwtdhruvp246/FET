# Household Ledger

A static family expense tracker that uses Supabase Auth and Postgres as the database. It is ready to push to GitHub and can be served from GitHub Pages.

## Features

- Email/password sign up and sign in
- Admin dashboard with Dashboard, Heads, Finance, and Households pages
- Admin can approve, suspend, reactivate, or revoke heads of family
- Admin can manually record user payments
- Payment history with amount, method, date, period, notes, and reference number
- Head billing status: paid, unpaid, or overdue
- Approved heads can create and manage their own households
- Household setup with currency and monthly budget
- Add family members with roles and allowances
- Add, filter, delete, and export expenses
- Row Level Security policies for private household data
- No frontend service role key

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Sign up in the app with the email you want to use as the admin account.
4. In Supabase SQL Editor, run this once, replacing the email:

```sql
insert into public.app_admins (user_id, email)
select id, lower(email)
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
```

5. Sign out and sign back in. You should now see the admin dashboard.
6. In Supabase Auth settings, add your local and GitHub Pages URLs to allowed redirect URLs:
   - `http://localhost:8000`
   - `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/`
7. Open `config.js` and replace the placeholders:

```js
window.EXPENSE_TRACKER_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabasePublishableKey: "YOUR-SUPABASE-PUBLISHABLE-KEY"
};
```

Use the publishable key only. Never put a Supabase service role or secret key in this frontend.

Recent Supabase projects may require tables to be explicitly available to the Data API. The schema includes `GRANT` statements for the authenticated role and enables RLS on every app table.

## How access works

The admin account approves heads of family by email. A head of family then signs up with that same email address and can create their household, add family members, and track expenses.

If the admin suspends a head of family, that user is blocked from the household area until the admin reactivates them.

## Admin finance workflow

1. Go to the Admin `Heads` page.
2. Add the head of family with name, email, monthly fee, and billing status.
3. Go to the Admin `Finance` page.
4. Choose the head of family.
5. Add amount, currency, payment method, payment date, billing period, optional reference, optional paid-until date, and notes.
6. Save the payment.

Recording a payment automatically marks that head as `paid` and updates their latest payment timestamp. If you set a paid-until date, it is stored on the head profile.

## Phase 1 and 2 test flow

1. Run the latest `supabase/schema.sql`.
2. Sign in as the admin account.
3. Confirm the admin dashboard opens.
4. Add a head of family.
5. Sign up separately as that head email.
6. Confirm the head can create a household.
7. Sign back in as admin.
8. Suspend the head.
9. Sign in as the head and confirm the suspended screen appears.
10. Sign in as admin, reactivate the head, then record a manual payment on the Finance page.

Because this is a static GitHub Pages app, it does not create Supabase Auth users from the browser. That would require a secret service role key, and secret keys should never be shipped in frontend code.

## Run locally

From this folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Upload to GitHub

```bash
git init
git add .
git commit -m "Build family expense tracker"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

If you enable GitHub Pages with GitHub Actions, the included workflow deploys the static site.
