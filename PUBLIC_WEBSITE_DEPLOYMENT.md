# Mushavo Budget public website deployment

This release uses a direct Supabase enquiry workflow:

`contact.html → public.enquiries → Admin Enquiries`

It does **not** use a Supabase Edge Function for enquiries. The browser uses the public Supabase publishable key. Row Level Security (RLS) permits validated inserts but prevents public reading, updating, and deleting.

## 1. Upload the website files

Upload the changed root files to the same public folder as `index.html`. Preserve every folder path from the release ZIP. The `supabase/` folder belongs in the local project or source repository and is not uploaded as a browser asset.

Confirm these pages open:

- `/index.html` — Home
- `/about.html` — About
- `/pricing.html` — live Pricing
- `/contact.html` — enquiry form
- `/app.html` — sign-in and authenticated app
- `/signup.html` — registration

Keep the publishable key in `config.js`. This key is designed for browser use and relies on RLS. Never put a Supabase service-role key in `config.js`, HTML, or any other frontend file.

## 2. Apply the SQL

### Existing Supabase project

If you have not applied the public website migrations yet, run these files in this order in **Supabase Dashboard → SQL Editor**:

1. `supabase/migrations/20260903090000_public_website_enquiries.sql`
2. `supabase/migrations/20260903091000_dynamic_family_plan_selection.sql`
3. `supabase/migrations/20260903120000_align_enquiry_workflow.sql`
4. `supabase/migrations/20260903123000_direct_enquiry_submission.sql`

If you already ran the first three files from the earlier release, run only:

`supabase/migrations/20260903123000_direct_enquiry_submission.sql`

The final migration grants anonymous and authenticated visitors insert access to only these columns:

- `full_name`
- `email`
- `country_name`
- `country_code`
- `enquiry_type`
- `message`

Visitors cannot set status, assignment, handling, or audit fields. They cannot select, update, or delete enquiries. Staff read/update policies remain protected by `is_platform_staff(...)`.

### New Supabase project

Run the complete `supabase/schema.sql`. Do not run the migrations again on the same fresh database.

Confirm these items exist:

- `public.enquiries`
- `public.countries`
- RLS policy `Public can submit enquiries`
- RLS policy `Staff can read enquiries`
- RLS policy `Staff can update enquiries`
- `public.get_public_plan_catalogue`
- `public.save_plan_definition`

## 3. Remove the obsolete enquiry Edge Function

Delete this source folder if it exists:

`supabase/functions/submit-enquiry/`

If the old function was deployed, remove it from Supabase in PowerShell:

```powershell
$projectRef = "kttkospkblwvguuwnhjj"
npx.cmd supabase functions delete submit-enquiry --project-ref $projectRef
```

This does not affect `sync-exchange-rates`; that separate Edge Function is still required for the private CurrencyAPI integration.

The enquiry workflow no longer uses these function secrets. They may be removed from Supabase if they were created only for enquiries:

- `PUBLIC_SITE_ORIGINS`
- `TURNSTILE_SECRET_KEY`

Do not remove CurrencyAPI, scheduler, notification, or other unrelated secrets.

## 4. Configure authentication URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to the live website origin.
2. Add the live `app.html` and `signup.html` URLs to **Redirect URLs**.
3. Add these while testing locally:

```text
http://localhost:8000/app.html
http://localhost:8000/signup.html
```

## 5. Configure public plans

1. Sign in to `app.html` as Super Admin or Admin Staff.
2. Open **Plans**.
3. Set each plan’s public summary, included people, features, order, and button text.
4. Enable **Show on public Pricing page**.
5. Enable **Available for purchase** when appropriate.
6. Publish monthly and annual prices for each supported currency.

Pricing is read from Supabase, so an admin price or plan change appears on the public Pricing page after refresh.

## 6. Test enquiry security and workflow

1. Open `contact.html` while signed out.
2. Submit a valid enquiry and confirm the success panel appears.
3. Sign in as an administrator and open **Enquiries**.
4. Confirm the enquiry contains the correct name, email, country, type, and message.
5. Test **Mark New**, **In Progress**, **Resolved**, **Archive**, and **Reply by email**.
6. While signed out, try selecting `/rest/v1/enquiries` with the publishable key. Supabase must return no enquiry data or an authorization error.
7. Sign in as an ordinary non-staff user and confirm the table cannot be read or updated.
8. Confirm neither a visitor nor an ordinary user can choose `status`, `handled_by`, or `handled_at` during insertion.

Direct anonymous insertion protects enquiry confidentiality and admin authorization through RLS. Without an Edge Function there is no reliable server-side IP rate limiting or private CAPTCHA verification. If automated spam later becomes a problem, those protections would require a server-side endpoint.

## 7. Refresh the service worker

This release uses cache `mushavo-budget-v41`.

1. Upload all changed files together.
2. Open the website once while online.
3. Close every Mushavo Budget tab and installed PWA window.
4. Reopen the website.
5. If an old file remains, clear cached site data once and reopen it.

The service worker continues to provide the existing offline cache. It does not submit or store enquiries offline.
