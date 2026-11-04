# BEC Content & Lead Tracking app

A BEC product catalog with account-based lead tracking. Once configured, lead
records and their activity history are stored in Supabase; the browser does not
keep a local copy.
Customers submit product enquiries to BEC, and authorized BEC staff can review
enquiries across customer accounts.

## Try the demo

Open the published app at
<https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/> or preview the
catalog locally with a small HTTP server:

```powershell
python -m http.server 8000 --directory webapp
```

Then open `http://localhost:8000`.

1. Browse or search the product catalog and inspect the representative setup
   images.
2. Connect a Supabase project using the setup below, then create a customer
   account or sign in. BEC staff sign in using an account provisioned by a BEC
   administrator.
3. Customers submit an enquiry using their name, organization, product, and at
   least one contact method. BEC staff can review enquiries across customer
   accounts and update their status.
4. Open **Recent activity** to see enquiry submissions, BEC status changes,
   removals, successful sign-ins, sign-out requests, and CSV exports. Existing
   sessions restored after a page reload are not counted as new sign-ins.
   Catalog browsing and searches are not tracked. Choose **Export CSV** to
   download the records visible to your account.

## Cloud database setup

The app is a static site, so it needs a separate database service for shared,
cross-device storage. Supabase is the configured option. Its free plan has
usage, storage, and availability limits; no free hosted database is unlimited.
Check the current Supabase plan limits before using the app for business-critical
or high-volume data.

1. Create a Supabase project and configure email/password authentication. Keep
   email confirmation enabled and configure rate limits/CAPTCHA for public
   signup. Configure the project’s site URL and redirect allowlist for the deployed
   GitHub Pages site and any local preview URL.
2. Open the Supabase SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
   It creates customer-owned enquiries and a database activity history, grants
   BEC staff cross-customer access using a trusted role claim, and records lead
   inserts, status updates, deletions, successful sign-ins, sign-out requests,
   and CSV exports.
3. In [`config.js`](./config.js), set `url` to the project URL and
   `publishableKey` to the project’s public anon/publishable key. These values
   are visible in a static website. **Never put a service-role key, database
   password, or other secret in this file.** The row-level security policies
   are the access boundary.
4. Provision BEC staff accounts through a trusted administrator environment,
   assigning `app_metadata.role = "bec_staff"` with the Supabase Auth Admin API.
   Do not assign this role from the customer-facing website or put an
   administrator/service-role key in the browser. Public signups cannot grant
   themselves the staff role.
5. Deploy the updated site. Until a valid project URL and publishable key are
   configured, the tracker stays unavailable and does not save lead data in
   the browser.

Customers can read only their own enquiries and activity. They cannot change
their submitted contact data or see another customer. BEC staff can see customer
account emails and enquiry details, update statuses, and review the activity
history. Do not use shared accounts for separate customers. BEC staff roles
must be assigned using the Supabase Auth Admin API from a trusted server or
administrator environment:

```js
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { role: "bec_staff" },
});
```

Never expose `supabaseAdmin` or its service-role key to the browser. The
append-only activity table is not editable through the app; deleting an enquiry
is recorded as an activity. Account deletion removes that account's enquiries
and activity because the database uses a cascade. Configure email/account
recovery support and data-retention rules before using this for real customer
data.

CSV export uses the browser’s save-file dialog where supported. Select the
`D:\dev\BEC\Lead Exports` folder to save exports there. Other browsers use their
normal download location; a website cannot silently choose a folder on your
computer.

Product setup images are representative and configurations vary by project.
Confirm specifications and package contents with BEC before making a purchasing
decision.

The GitHub Pages workflow publishes the `webapp/` directory. The CI workflow
checks the product catalog and required app files on each change.
