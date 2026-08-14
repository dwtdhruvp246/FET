# Household Ledger

A static family expense tracker that uses Supabase Auth and Postgres as the database. It is ready to push to GitHub and can be served from GitHub Pages.

## Features

- Email/password sign up and sign in
- Admin dashboard for approving heads of family
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
