# Recurring Family Payments Plan

## Product Direction

This app should be centered on recurring obligations, not general expenses. A household needs to know what must be paid, who is responsible, when it is due, how much is due, whether it was paid in full, and who needs a reminder.

## Core Objects

- Household: the family workspace.
- Family member: a person who can be assigned payment responsibility.
- Payment item: the repeating obligation, such as rent, electricity, school fees, insurance, or a yearly license.
- Payment occurrence: one due instance of a payment item, such as Rent for August 2026.
- Payment record: an amount paid against an occurrence, supporting partial and full payments.
- Reminder rule: when and how the responsible person should be reminded.

## Admin System

The admin account should control the business and support side of the platform.

- Household directory with status, plan, payment access, last activity, and overdue count.
- User directory with role, login email, household, member access, and suspension controls.
- Subscription finance for payments made by households to the platform owner.
- Household detail page showing members, recurring items, overdue obligations, and recent payments.
- Manual override tools for unlocking member access, suspending accounts, marking platform subscription payments, and correcting household data.
- Support notes so the admin can record what was discussed with a family.
- Audit trail for admin actions such as unlocking access, suspending a household, or editing billing status.

## Family Workspace

The family workspace should feel like a payment command center.

- Dashboard: due soon, overdue, paid this month, partially paid, and total expected this month.
- Payment items: create recurring obligations and assign responsible members.
- Due calendar: month view of upcoming payments.
- My responsibilities: member-specific list of assigned payments.
- Payment records: full and partial payments with date, amount, note, and reference.
- Members: contact info, role, login link status, and reminder preference.
- Reports: paid rate, overdue trend, member responsibility totals, and yearly totals.

## Recommended Phases

### Phase 1: Stabilize App Shell

- Keep protected refreshes on the current page.
- Add initial auth loading state so login does not flash.
- Make admin and family navigation sticky, responsive, and URL-aware.
- Rename product language away from expenses where possible.
- Keep current household/member/admin foundation.

### Phase 2: Recurring Payment Data Model

- Add payment_items.
- Add recurrence settings: once, monthly, every N months, yearly.
- Add responsible_member_id.
- Add amount, currency, category, start date, optional end date, and active status.
- Add reminder preference fields that can be used later by email or push reminders.
- Keep RLS restricted by household ownership/admin access.

### Phase 3: Payment Occurrences

- Generate or calculate due instances for each payment item.
- Track due date, expected amount, paid amount, and status.
- Support upcoming, due soon, overdue, partial, paid, and skipped.
- Add dashboard counts and lists based on occurrences, not raw expenses.

### Phase 4: Partial and Full Payment Tracking

- Add payment_records against payment occurrences.
- Allow multiple partial payments.
- Automatically calculate outstanding balance.
- Mark an occurrence paid only when paid amount reaches expected amount.
- Store notes, payment method, reference number, and paid by member.

### Phase 5: Member Responsibility Experience

- Let family members have contact details and optional login accounts.
- Add "My payments" view for each member.
- Let members mark assigned payments as paid or partially paid.
- Let the head of family review and correct payment records.
- Prepare member account linking without exposing service-role keys.

### Phase 6: Admin Household Control

- Build a proper household detail page for the admin.
- Show each household's recurring items, overdue obligations, members, and platform subscription status.
- Add admin notes and admin action history.
- Add filters for overdue households, locked households, unpaid platform subscription, and inactive families.

### Phase 7: Reminder Engine

- Add in-app reminder cards first.
- Add browser/PWA notification prompts where supported.
- Prepare reminder_rules for email reminders.
- Later add Supabase Edge Functions, scheduled jobs, and Resend.
- Send due soon, due today, overdue, and payment-confirmation emails.

### Phase 8: Reports and Trust Features

- Add monthly and yearly payment reliability reports.
- Add member responsibility summaries.
- Add export to CSV/PDF.
- Add proof-of-payment attachment support later through Supabase Storage.
- Add audit logs for important edits and payment changes.

## Reminder Architecture

GitHub Pages alone cannot send scheduled reminders. It can show in-app and PWA-style reminders while the app is used. Automatic email reminders should be added later with:

- Supabase Edge Functions
- Supabase scheduled jobs or cron
- Resend for email delivery
- Reminder rules stored in Postgres

## Immediate Build Recommendation

Start by preserving the login, household, family member, admin, and PWA foundation. Then replace the expense-centered workspace with payment items, payment occurrences, and payment records.
