import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from automation import generate_content
from automation.generate_content import VisibleText, extract_model_json, scrape_source


ROOT = Path(__file__).resolve().parents[2]


class ContentWorkflowTests(unittest.TestCase):
    def test_catalog_has_unique_products_and_official_sources(self):
        catalog = json.loads((ROOT / "webapp" / "products.json").read_text(encoding="utf-8"))
        ids = [product["id"] for product in catalog]

        self.assertTrue(catalog)
        self.assertEqual(len(ids), len(set(ids)))
        for product in catalog:
            self.assertRegex(product["id"], r"^[a-z0-9-]+$")
            self.assertTrue(product["name"].strip())
            self.assertTrue(product["description"].strip())
            self.assertEqual(product["source_url"].split("/")[2], "becintegrated.com")
            self.assertTrue(product["images"], f"{product['id']} needs setup images")
            for image in product["images"]:
                self.assertTrue(image["alt"].strip())
                self.assertTrue(image["caption"].strip())
                image_path = ROOT / "webapp" / image["src"].removeprefix("./")
                self.assertTrue(image_path.is_file(), f"missing {image_path}")

    def test_site_assets_and_catalog_loader_exist(self):
        for name in ("index.html", "styles.css", "app.js", "products.json"):
            self.assertTrue((ROOT / "webapp" / name).is_file(), name)
        self.assertTrue((ROOT / "webapp" / "assets" / "bec-logo.png").is_file())
        page = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
        self.assertIn("./products.json", (ROOT / "webapp" / "app.js").read_text(encoding="utf-8"))
        self.assertIn("./styles.css", page)
        self.assertIn("./app.js", page)
        self.assertIn("exact equipment varies", page)

    def test_scraper_extracts_visible_text_and_skips_chrome(self):
        parser = VisibleText()
        parser.feed(
            "<html><header>Brand</header><nav>Menu</nav><main>"
            "<p>Official product details</p><script>hidden secret</script>"
            "</main><footer>Footer</footer></html>"
        )
        self.assertIn("Official product details", " ".join(parser.parts))
        self.assertNotIn("Menu", parser.parts)
        self.assertNotIn("hidden secret", parser.parts)
        self.assertNotIn("Footer", parser.parts)

    def test_model_json_accepts_fenced_json_and_checks_fields(self):
        data = {"headline": "A useful heading", "body": "A concise draft.", "image_prompt": "A realistic lobby."}
        response = {"candidates": [{"content": {"parts": [{"text": f"```json\n{json.dumps(data)}\n```"}]}}]}

        self.assertEqual(extract_model_json(response), data)
        with self.assertRaisesRegex(RuntimeError, "must include"):
            extract_model_json({"candidates": [{"content": {"parts": [{"text": '{"headline": "Only"}'}]}}]})

    def test_product_scraper_rejects_non_official_domain(self):
        with self.assertRaisesRegex(RuntimeError, "official becintegrated.com"):
            scrape_source("https://example.com/product")

    def test_comfyui_workflow_is_api_format_with_explicit_placeholders(self):
        workflow = json.loads((ROOT / "automation" / "comfyui_api_workflow.json").read_text(encoding="utf-8"))
        self.assertEqual(workflow["4"]["inputs"]["ckpt_name"], "REPLACE_WITH_INSTALLED_CHECKPOINT")
        self.assertEqual(workflow["6"]["inputs"]["text"], "REPLACE_WITH_POSITIVE_PROMPT")

    def test_pipeline_writes_reviewable_campaign_and_pages(self):
        image = b"\x89PNG\r\n\x1a\nmock-image"
        generated = {
            "headline": "A sample campaign",
            "body": "A factual product draft for review.",
            "image_prompt": "A realistic healthcare reception area.",
        }
        with tempfile.TemporaryDirectory() as output:
            with (
                patch.dict(os.environ, {
                    "GEMINI_API_KEY": "test-key",
                    "COMFYUI_BASE_URL": "https://comfy.example",
                }),
                patch.object(sys, "argv", [
                    "generate_content.py",
                    "--product", "mv200plus",
                    "--brief", "Audience: facilities teams\nGoal: explain options",
                    "--output", output,
                    "--run-id", "test-run",
                ]),
                patch.object(generate_content, "scrape_source", return_value="Official source text."),
                patch.object(generate_content, "generate_copy", return_value=generated),
                patch.object(generate_content, "generate_image", return_value=image),
            ):
                self.assertEqual(generate_content.main(), 0)

            campaign = Path(output) / "campaigns" / "mv200plus-test-run"
            self.assertEqual((campaign / "campaign.png").read_bytes(), image)
            self.assertIn("A sample campaign", (campaign / "index.html").read_text(encoding="utf-8"))
            self.assertIn("becintegrated.com", (campaign / "campaign.json").read_text(encoding="utf-8"))
            self.assertNotIn("Official source text", "\n".join(
                path.read_text(encoding="utf-8")
                for path in campaign.iterdir()
                if path.suffix in {".html", ".json", ".md"}
            ))


if __name__ == "__main__":
    unittest.main()
