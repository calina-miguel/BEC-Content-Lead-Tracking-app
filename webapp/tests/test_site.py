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

    def test_page_has_cloud_account_controls_and_activity_history(self):
        page = (WEBAPP / "index.html").read_text(encoding="utf-8")
        for element_id in (
            "product-list",
            "database-setup",
            "auth-form",
            "account-workspace",
            "account-toolbar",
            "sign-in",
            "sign-up",
            "sign-out",
            "lead-form",
            "lead-name",
            "lead-organization",
            "lead-email",
            "lead-phone",
            "lead-product",
            "lead-notes",
            "lead-search",
            "status-filter",
            "lead-rows",
            "export-leads",
            "activity-list",
        ):
            self.assertIn(f'id="{element_id}"', page)
        for required_copy in (
            "Customer or BEC staff sign-in",
            "Send BEC a product enquiry",
            "authorized BEC personnel",
        ):
            self.assertIn(required_copy, page)
        self.assertIn("authorized BEC personnel", page)
        self.assertIn("supabase-js", page)

    def test_app_uses_authenticated_cloud_storage_and_csv_export(self):
        app = (WEBAPP / "app.js").read_text(encoding="utf-8")
        for required_behavior in (
            "signInWithPassword",
            "client.auth.signUp",
            'from("leads")',
            'from("lead_activity")',
            'rpc("log_account_activity"',
            "window.confirm",
            "text/csv;charset=utf-8",
            "bec-leads.csv",
            "showSaveFilePicker",
            'user?.app_metadata?.role === "bec_staff"',
        ):
            self.assertIn(required_behavior, app)
        self.assertNotIn("localStorage", app)
        self.assertIn("Enter an email address or phone number", app)
        self.assertIn("Customer account", app)
        schema = (WEBAPP / "supabase" / "schema.sql").read_text(encoding="utf-8")
        self.assertIn("customer_email text not null default coalesce(auth.jwt() ->> 'email', '')", schema)
        insert_block = app.split('client.from("leads").insert(lead)', maxsplit=1)[0].rsplit("const lead = {", maxsplit=1)[-1]
        self.assertNotIn("customer_email:", insert_block)
        auth_handler = app.split("client.auth.onAuthStateChange(", maxsplit=1)[1].split("});", maxsplit=1)[0]
        self.assertIn('_event === "SIGNED_IN"', auth_handler)
        self.assertNotIn('logAccountActivity("signed_in")', app.split("async function setCurrentUser", maxsplit=1)[1].split("function csvCell", maxsplit=1)[0])
        sign_out_handler = app.split("async function signOut()", maxsplit=1)[1].split("productSearch.addEventListener", maxsplit=1)[0]
        self.assertIn('logAccountActivity("sign_out_requested")', sign_out_handler)
        self.assertLess(sign_out_handler.index('logAccountActivity("sign_out_requested")'),
                        sign_out_handler.index("client.auth.signOut()"))
        self.assertIn("client.auth.signOut()", sign_out_handler)
        export_block = app.split("async function exportLeads()", maxsplit=1)[1]
        self.assertLess(export_block.index('await logAccountActivity("exported")'),
                        export_block.index('showLeadStatus("Lead list saved.")'))

    def test_product_selection_buttons_choose_enquiry_product(self):
        app = (WEBAPP / "app.js").read_text(encoding="utf-8")
        self.assertIn('chooseButton.textContent = "Choose this product"', app)
        self.assertIn('chooseButton.setAttribute("aria-pressed"', app)
        self.assertIn("selectedProductId = product.id", app)
        self.assertIn("leadProduct.value = product.id", app)
        self.assertIn('document.querySelector(".lead-panel").scrollIntoView', app)
        self.assertIn('.product-select.is-selected', (WEBAPP / "styles.css").read_text(encoding="utf-8"))

    def test_database_schema_is_customer_scoped_and_allows_bec_staff(self):
        schema = (WEBAPP / "supabase" / "schema.sql").read_text(encoding="utf-8")
        for required_clause in (
            "enable row level security",
            "auth.uid()",
            "public.is_bec_staff()",
            "app_metadata' ->> 'role'",
            "Owners can read their leads",
            "Owners can add their leads",
            "BEC staff can update customer leads",
            "BEC staff can delete customer leads",
            "Owners can read their activity",
            "customer_email",
            "after insert or update or delete",
            "'signed_in', 'sign_out_requested', 'exported'",
            "log_account_activity",
            'drop policy if exists "Owners can update their leads"',
            'drop policy if exists "Owners can delete their leads"',
            "revoke insert, update on public.leads from authenticated",
            "grant update (status) on public.leads to authenticated",
            "and status = 'New'",
            "security definer",
            "set search_path = ''",
            "revoke all on public.leads, public.lead_activity from anon",
        ):
            self.assertIn(required_clause, schema)
        self.assertNotIn('create policy "Owners can update their leads"', schema)
        self.assertNotIn('create policy "Owners can delete their leads"', schema)

    def test_static_site_assets_exist(self):
        for name in ("index.html", "styles.css", "app.js", "config.js", "products.json"):
            self.assertTrue((WEBAPP / name).is_file(), name)
        self.assertTrue((WEBAPP / "assets" / "bec-logo.png").is_file())
        self.assertTrue((WEBAPP / "supabase" / "schema.sql").is_file())
        self.assertTrue((WEBAPP / "tests" / "test_site.py").is_file())


if __name__ == "__main__":
    unittest.main()
