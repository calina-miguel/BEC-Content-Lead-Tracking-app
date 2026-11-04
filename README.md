# BEC Content & Lead Tracking app

The public product catalog is separate from the BEC staff workspace.

- Public catalog: <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/>
- Staff sign-in: <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/staff-login.html>
- Staff dashboard: <https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/staff.html>

The static website includes the BEC product catalog, galleries, and a staff
workspace preview with sample leads and a campaign composer. Demo mode requires
no credentials and never accesses or changes live customer data. Live staff
data still requires a BEC-provisioned account. Campaign submissions save drafts
to a review queue; they do not connect to social networks or post automatically.

- [`webapp/`](./webapp/) contains the public catalog and staff workspace.
- [`webapp/supabase/schema.sql`](./webapp/supabase/schema.sql) creates the
  customer/staff data model, row-level security, activity log, and campaign
  queue.
- [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) publishes the
  static app to GitHub Pages.
- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) checks product
  assets and the staff-workspace structure.

See [`webapp/README.md`](./webapp/README.md) for database configuration,
administrator-only staff provisioning, the staff workflow, and local tests.
