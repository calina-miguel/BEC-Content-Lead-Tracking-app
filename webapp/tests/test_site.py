import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WEBAPP = ROOT / "webapp"


class LeadTrackerSiteTests(unittest.TestCase):
    def test_catalog_products_and_gallery_assets_are_complete(self):
        catalog = json.loads((WEBAPP / "products.json").read_text(encoding="utf-8"))
        ids = [product["id"] for product in catalog]

        self.assertEqual(len(catalog), 8)
        self.assertEqual(len(ids), len(set(ids)))
        for product in catalog:
            self.assertTrue(product["name"].strip())
            self.assertEqual(product["source_url"].split("/")[2], "becintegrated.com")
            self.assertTrue(product["images"])
            for image in product["images"]:
                self.assertTrue(image["alt"].strip())
                self.assertTrue(image["caption"].strip())
                image_path = (WEBAPP / image["src"].removeprefix("./")).resolve()
                self.assertTrue(image_path.is_relative_to(WEBAPP.resolve()))
                self.assertTrue(image_path.is_file(), f"missing {image_path}")

    def test_public_page_is_catalog_with_staff_login_link(self):
        page = (WEBAPP / "index.html").read_text(encoding="utf-8")
        for required in ('id="product-list"', 'id="product-search"', 'href="./staff-login.html"',
                         "Choose a solution", "BEC staff login"):
            self.assertIn(required, page)
        for private_control in ('id="lead-form"', 'id="staff-workspace"', 'id="staff-password"'):
            self.assertNotIn(private_control, page)

    def test_staff_login_requires_configured_auth_and_staff_role(self):
        page = (WEBAPP / "staff-login.html").read_text(encoding="utf-8")
        script = (WEBAPP / "staff-login.js").read_text(encoding="utf-8")
        self.assertIn('id="staff-login-form"', page)
        self.assertIn('type="password"', page)
        self.assertIn("signInWithPassword", script)
        self.assertIn('data.user?.app_metadata?.role !== "bec_staff"', script)
        self.assertIn('loginClient.auth.signOut()', script)
        self.assertNotIn("signUp", script)

    def test_staff_workspace_includes_leads_campaign_preview_and_destinations(self):
        page = (WEBAPP / "staff.html").read_text(encoding="utf-8")
        script = (WEBAPP / "staff.js").read_text(encoding="utf-8")
        for element_id in ("lead-tracker", "staff-lead-search", "staff-status-filter",
                           "staff-export-leads", "campaign-studio", "campaign-preview-list",
                           "submit-campaign", "social-account-form", "staff-activity"):
            self.assertIn(f'id="{element_id}"', page)
        for behavior in ('from("leads")', 'from("social_accounts")', 'from("campaigns")',
                         'rpc("submit_campaign"', "composePost", "app_metadata?.role !== \"bec_staff\"",
                         "text/csv;charset=utf-8", "showSaveFilePicker",
                         "It has not been published to social platforms."):
            self.assertIn(behavior, script)
        self.assertNotIn("localStorage", script)

    def test_campaign_schema_is_staff_only_and_submits_atomically(self):
        schema = (WEBAPP / "supabase" / "schema.sql").read_text(encoding="utf-8")
        for required in (
            "public.social_accounts",
            "public.campaigns",
            "public.campaign_submissions",
            "enable row level security",
            "public.is_bec_staff()",
            "BEC staff can read social accounts",
            "BEC staff can read campaigns",
            "BEC staff can read campaign submissions",
            "create or replace function public.submit_campaign(",
            "security definer",
            "set search_path = ''",
            "raise exception 'BEC staff access is required to submit campaigns.'",
            "raise exception 'A selected social destination no longer exists.'",
            "'campaign_submitted'",
            "on delete set null",
            "revoke insert, update, delete on public.campaigns, public.campaign_submissions from authenticated",
            "grant execute on function public.submit_campaign",
        ):
            self.assertIn(required, schema)

    def test_styles_and_required_site_assets_exist(self):
        for name in (
            "index.html", "staff-login.html", "staff-login.js", "staff.html", "staff.js",
            "styles.css", "app.js", "config.js", "products.json",
        ):
            self.assertTrue((WEBAPP / name).is_file(), name)
        self.assertTrue((WEBAPP / "assets" / "bec-logo.png").is_file())
        self.assertTrue((WEBAPP / "supabase" / "schema.sql").is_file())


if __name__ == "__main__":
    unittest.main()
