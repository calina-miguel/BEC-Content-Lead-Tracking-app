# BEC Content & Lead Tracking app

Browse BEC Integrated Solutions products and submit enquiries to BEC. Once
cloud storage is configured, authorized BEC personnel can review customer
enquiries and their activity history in the staff workspace.

- [`webapp/`](./webapp/) contains the product catalog and account-based lead
  tracker.
- [`webapp/supabase/schema.sql`](./webapp/supabase/schema.sql) creates secure
  customer-owned records, BEC staff access policies, and a database activity log.
- [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) publishes the
  static app to GitHub Pages.
- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) checks the catalog
  and required app files.

Try the live app at <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/>.
See [`webapp/README.md`](./webapp/README.md) for database configuration, staff
account provisioning, and free-plan limits.
