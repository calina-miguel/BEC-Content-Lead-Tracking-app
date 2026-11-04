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

    def test_demo_page_has_all_lead_tracker_controls(self):
        page = (WEBAPP / "index.html").read_text(encoding="utf-8")
        for element_id in (
            "product-list", "lead-form", "lead-name", "lead-organization",
            "lead-email", "lead-phone", "lead-product", "lead-notes",
            "lead-search", "status-filter", "lead-rows", "export-leads",
            "restore-demo",
        ):
            self.assertIn(f'id="{element_id}"', page)
        self.assertIn("fictional details", page)
        self.assertIn("stays in this browser", page)

    def test_app_persists_leads_and_supports_csv_export(self):
        app = (WEBAPP / "app.js").read_text(encoding="utf-8")
        for required_behavior in (
            "localStorage.setItem", "localStorage.getItem", "window.confirm",
            "crypto.randomUUID", "text/csv;charset=utf-8", "bec-leads.csv",
            "restore-demo",
        ):
            self.assertIn(required_behavior, app)
        self.assertIn("Enter an email address or phone number", app)

    def test_static_site_assets_exist(self):
        for name in ("index.html", "styles.css", "app.js", "products.json"):
            self.assertTrue((WEBAPP / name).is_file(), name)
        self.assertTrue((WEBAPP / "assets" / "bec-logo.png").is_file())
        self.assertTrue((WEBAPP / "tests" / "test_site.py").is_file())


if __name__ == "__main__":
    unittest.main()
