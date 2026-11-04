# BEC Content & Lead Tracking app

The public product catalog is separate from the BEC staff workspace:

- Public catalog: <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/>
- Staff sign-in: <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/staff-login.html>
- Staff dashboard: <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/staff.html>

The site is static. Shared customer and staff data require a configured
Supabase project; no customer records are saved in the browser as a fallback.
Supabase free-plan services have usage, storage, and availability limits, not
unlimited storage. Review the current plan limits before using the app for
business-critical or high-volume activity.

## Set up the database and authentication

1. Create a Supabase project. Enable email/password sign-in, keep email
   confirmation enabled, configure the site URL and redirect allowlist for the
   deployed site and any local preview, and set appropriate signup rate limits.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL
   Editor. The script creates customer-owned enquiries, staff-only access
   policies, activity history, social-account destinations, campaign records,
   and a transaction-backed campaign submission function.
3. Set `url` and `publishableKey` in [`config.js`](./config.js) to the Supabase
   project URL and public anon/publishable key. These values are visible to
   website visitors. **Never place a service-role key, database password, or
   other secret in this file.** Row-level security is the data access boundary.
4. Provision staff accounts from a trusted administrator environment by
   assigning `app_metadata.role = "bec_staff"` using the Supabase Auth Admin
   API. For example:

   ```js
   await supabaseAdmin.auth.admin.updateUserById(userId, {
     app_metadata: { role: "bec_staff" },
   });
   ```

   Never expose `supabaseAdmin` or its service-role key in the browser.
   Customer signups cannot assign themselves the staff role.
5. Deploy the site. Until a valid project URL, publishable key, schema, and
   staff account are configured, staff sign-in and cloud operations are
   unavailable.

Customers can create and read only their own enquiries. BEC staff can read
enquiries across customer accounts, update lead statuses, manage social
destinations, and review campaigns and activity. The browser cannot grant a
staff role. Activity is recorded in the database; campaign records and their
selected destination posts are inserted together or not at all.

## Staff workflow

1. Open **BEC staff login** from the public product catalog and sign in with a
   provisioned staff account.
2. Filter and search customer enquiries, update a lead's status, or export the
   visible enquiries as CSV.
3. Add the BEC social profile names and handles under **Social account
   destinations**, then select one or more accounts in the campaign composer.
4. Choose a product, campaign goal, and audience; add approved message details
   and a call to action; review the per-platform previews; and submit the
   campaign to the BEC review queue.

Social account destinations are labels only in this version. OAuth, platform
account verification, approvals, and automatic posting are not connected.
Submitting a campaign records drafts for the selected destinations; a staff
member must publish through the relevant social platform. The preview uses a
local template and product catalog information. Review all copy and product
claims before use.

CSV export uses the browser's save-file dialog where supported. Choose
`D:\dev\BEC\Lead Exports` as the destination if you want to keep exports in
that folder. Other browsers use their normal download location; a website
cannot silently choose a folder on your computer.

Product setup images are representative; exact equipment varies by facility
and project scope. Confirm specifications and package contents with BEC before
making a purchasing decision.

## Local preview and tests

Run a local static server from the repository root:

```powershell
python -m http.server 8000 --directory webapp
```

Open `http://localhost:8000`. Configure Supabase's allowed site URLs before
testing authentication locally. Run the static-site checks from the repository
root:

```powershell
python -m unittest discover -s webapp/tests -v
```
