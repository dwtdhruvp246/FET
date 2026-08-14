# Household Ledger

A static family expense tracker that uses Supabase Auth and Postgres as the database. It is ready to push to GitHub and can be served from GitHub Pages.

## Features

- Email/password sign up and sign in
- Admin dashboard with Dashboard, Heads, Finance, and Households pages
- Admin can unlock family-member access from the Households page or the Heads page
- Admin can suspend, reactivate, or revoke users
- Admin can manually record user payments
- Payment history with amount, method, date, period, notes, and reference number
- Head billing status: paid, unpaid, or overdue
- Any signed-up user can create and manage their own household
- Free users can track household-level expenses
- Admin-unlocked users can add family members
- Household workspace with Dashboard, Expenses, Members, Budget, and Reports pages
- Household setup with currency and monthly budget
- Add family members with roles, allowances, spending limits, status, and profile color
- Add, edit, filter, delete, and export expenses
- Track who an expense was for and who paid it
- Member spending breakdowns and recent household ledger
- Category budgets, safe-to-spend, and reports
- Installable PWA for phones and desktop browsers
- Row Level Security policies for private household data
- No frontend service role key

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase Auth settings, turn off email confirmation while Resend/email delivery is not configured:
   - Authentication
   - Providers
   - Email
   - Disable `Confirm email`
4. Sign up in the app with the email you want to use as the admin account.
5. In Supabase SQL Editor, run this once, replacing the email:

```sql
insert into public.app_admins (user_id, email)
select id, lower(email)
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
```

6. Sign out and sign back in. You should now see the admin dashboard.
7. In Supabase Auth settings, add your local and GitHub Pages URLs to allowed redirect URLs:
   - `http://localhost:8000`
   - `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/`
8. Open `config.js` and replace the placeholders:

```js
window.EXPENSE_TRACKER_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabasePublishableKey: "YOUR-SUPABASE-PUBLISHABLE-KEY"
};
```

Use the publishable key only. Never put a Supabase service role or secret key in this frontend.

Recent Supabase projects may require tables to be explicitly available to the Data API. The schema includes `GRANT` statements for the authenticated role and enables RLS on every app table.

## How access works

Anyone can sign up with email and password. They can create a household and track household-level expenses immediately.

Adding family members is locked on free accounts. The admin unlocks it from Admin `Households`: once a free user creates a household, that household appears in the list. Click `Unlock members` on that household to create or update the owner's access settings and allow them to add family members. You can still use `Heads` as a manual directory for editing fees, billing status, and access.

If the admin suspends a head of family, that user is blocked from the household area until the admin reactivates them.

## Admin finance workflow

1. Go to the Admin `Heads` page.
2. Open the `Households` page and unlock member access for the user's household, or add the user manually on the `Heads` page.
3. Go to the Admin `Finance` page.
4. Choose the head of family.
5. Add amount, currency, payment method, payment date, billing period, optional reference, optional paid-until date, and notes.
6. Save the payment.

Recording a payment automatically marks that head as `paid` and updates their latest payment timestamp. If you set a paid-until date, it is stored on the head profile.

## Phase 1 and 2 test flow

1. Run the latest `supabase/schema.sql`.
2. Sign in as the admin account.
3. Confirm the admin dashboard opens.
4. Sign up separately as a normal user.
5. Confirm the user can create a household.
6. Confirm the user cannot add family members yet.
7. Sign back in as admin.
8. Add that user's email on the Heads page and enable family-member access.
9. Sign in as that user and confirm family-member adding works.
10. Sign in as admin, suspend/reactivate the user, then record a manual payment on the Finance page.

## Phase 3 and 4 test flow

1. Sign in as a user whose family-member access is unlocked.
2. Create a household if one does not exist yet.
3. Go to the Members page.
4. Add members with allowance, spending limit, and color.
5. Go to the Expenses page.
6. Add an expense and choose both `For` and `Paid by`.
7. Edit that expense and save it.
8. Go to Dashboard and confirm spending totals, recent expenses, and member breakdown update.
9. Mark a member inactive and confirm they stay in the roster but no longer appear in the new expense member selectors.

## Phase 5, 6 and 7 test flow

1. Sign up from the separate Create account screen.
2. Sign in with email and password.
3. Create a household without admin approval.
4. Try to add a family member and confirm it is locked.
5. As admin, open `Households` and click `Unlock members` for that household.
6. Return to the user account and confirm member adding works.
7. Go to Budget and save category limits.
8. Add expenses and confirm Budget progress updates.
9. Go to Reports and confirm category/member reports update.

Because this is a static GitHub Pages app, it does not create Supabase Auth users from the browser. That would require a secret service role key, and secret keys should never be shipped in frontend code.

## Run locally

From this folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Install on phone

After the site is published on GitHub Pages, open it on your phone:

- Android Chrome: open the site, tap the menu, then tap `Install app` or `Add to Home screen`.
- iPhone Safari: open the site, tap Share, then tap `Add to Home Screen`.

PWA installation requires HTTPS. GitHub Pages provides HTTPS, so the published site can be installed. Local `http://localhost:8000` is only for testing.

The app shell is cached for offline loading, but Supabase data still needs an internet connection to sign in and sync.

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
