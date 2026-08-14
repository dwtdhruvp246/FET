# Household Ledger

A static family expense tracker that uses Supabase Auth and Postgres as the database. It is ready to push to GitHub and can be served from GitHub Pages.

## Features

- Email/password sign up and sign in
- Household setup with currency and monthly budget
- Add family members with roles and allowances
- Add, filter, delete, and export expenses
- Row Level Security policies for private household data
- No frontend service role key

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase Auth settings, add your local and GitHub Pages URLs to allowed redirect URLs:
   - `http://localhost:8000`
   - `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/`
4. Open `config.js` and replace the placeholders:

```js
window.EXPENSE_TRACKER_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabasePublishableKey: "YOUR-SUPABASE-PUBLISHABLE-KEY"
};
```

Use the publishable key only. Never put a Supabase service role or secret key in this frontend.

Recent Supabase projects may require tables to be explicitly available to the Data API. The schema includes `GRANT` statements for the authenticated role and enables RLS on every app table.

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
