# Mushavo Budget workspace subscription deployment

## Decisions used in this release

- Paid plan prices are configured by an administrator; no price is invented in code.
- Monthly and annual billing are supported as separate effective-dated prices.
- Users submit payment details and optional private proof for manual review.
- Finance approval activates or extends an entitlement exactly once.
- Personal expiry falls back to Free. Household and Business expiry becomes read-only.
- Household includes four people total. Business includes the owner plus five team members.
- An additional Household member may be invited, but acceptance beyond the included seats requires an approved invoice that covers the additional seat.
- In-app notifications remain enabled. Web Push remains intentionally excluded.

## Deployment order

1. Back up the Supabase database before applying a production migration.
2. Open the Supabase project connected in `config.js`.
3. Open **SQL Editor** and create a new query.
4. Paste the complete contents of `supabase/schema.sql` and select **Run**.
5. Confirm that the SQL finishes without an error. The script is rerunnable and performs compatibility backfills instead of destructive family-table renames.
6. Confirm that these tables exist in **Table Editor**:
   - `budget_workspaces`
   - `workspace_members`
   - `workspace_settings`
   - `plans`
   - `plan_prices`
   - `workspace_subscriptions`
   - `subscription_invoices`
   - `subscription_renewal_requests`
   - `subscription_payments`
   - `subscription_payment_proofs`
   - `subscription_payment_reviews`
   - `subscription_entitlement_history`
   - `subscription_audit_events`
7. Confirm that the private `subscription-proofs` Storage bucket exists.
8. Upload the website files, preserving the `supabase/` folder.
9. Reload the deployed website once. Service worker cache `mushavo-budget-v26` replaces older cached application files.
10. Sign in as the Super Admin, open **Plans**, and publish monthly and annual prices.

## Configure plan prices

For each paid plan, save a monthly and annual price for every platform billing currency you accept:

| Plan | Base price | Additional-member price |
| --- | --- | --- |
| Personal | Required | Keep at zero |
| Household | Required | Price per person from the fifth total person |
| Business | Required | Price per team member after the owner plus five included members |

The annual additional-member amount is the full annual extra-seat price. Saving a new price deactivates the previous current price but does not alter existing invoices.

## Role setup

Existing `app_admins` rows become `super_admin`. To assign a narrower platform role, update the row in Supabase SQL Editor using one of:

- `super_admin`
- `admin_staff`
- `finance_staff`
- `support_staff`

Finance Staff can approve and reject subscription payments. Support Staff can view the queue and proof but cannot approve. Only Super Admin and Admin Staff can publish plan prices.

## Acceptance test

1. Register a new user and confirm the account appears in Admin **Users**.
2. Confirm that the user owns one Personal workspace with Free and Active status.
3. Add five active Personal payments. Confirm that a sixth is blocked by the database.
4. Pause one payment and confirm that one replacement can be added while history remains.
5. Open **Reports** on Free and confirm the locked plan state appears without analytics.
6. Open **Subscription**, select Personal, and test both monthly and annual prices.
7. Submit payment details without proof, then repeat with JPG, PNG, WebP, or PDF proof no larger than 10 MB.
8. Confirm a duplicate pending request for the same plan is blocked.
9. In Admin **Finance**, reject one request and confirm a reason is required and shown to the user.
10. Submit again and approve. Confirm the receipt number, invoice status, review row, entitlement history, notification, plan access, and paid-through time are created once.
11. Click Approve again and confirm the entitlement is not extended twice.
12. From a Free account, confirm the family creation form is unavailable and a direct call to `create_family_workspace` is rejected with `ACTIVE_FAMILY_MEMBERSHIP_REQUIRED`.
13. Activate the user's membership, create a Household workspace, approve its Household entitlement where required, and confirm the Family Head can invite members.
14. Confirm members one through four can use the Household plan without buying subscriptions.
15. Create an invitation for a fifth total person. Confirm the pending invitation is included in the renewal invoice total and that acceptance is blocked until the additional seat is covered by an approved invoice.
16. Remove a member and confirm their membership becomes inactive rather than losing historical references.
17. Suspend a Household in Admin and confirm it becomes read-only while the same user can still switch to Personal.
18. Set a Personal paid-through time in the past and confirm effective access falls back to Free without deleting payments.
19. Set a Household paid-through time in the past and confirm the shared workspace becomes read-only without deleting data.
20. Test that one ordinary user cannot select another user's workspace, subscription, invoice, payment, proof, or audit records through the Supabase API.
21. Test the layout at phone and desktop widths, including plan cards, invoice summaries, review actions, and long currency values.

## Recovery and forward-fix notes

- Do not delete the legacy `families`, `family_members`, `family_invitations`, `payments`, or `family_heads` tables. They remain linked for compatibility.
- If the SQL stops, keep the database backup and correct the reported statement, then rerun the complete schema. `if not exists`, upserts, and conflict guards make the migration retry-safe.
- Do not roll back by deleting populated workspace/subscription tables after users begin submitting payments. Correct production issues with a forward migration so invoices, proofs, reviews, receipts, and audit history remain intact.
- If the frontend is uploaded before the schema, users will see a workspace reconciliation error. Apply the complete schema first, then reload the site.
- Never put a Supabase service-role key in `config.js`, `app.js`, or any other browser file.
