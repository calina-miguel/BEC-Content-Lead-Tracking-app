#!/usr/bin/env python3
"""Generate a product campaign with Gemini and a configured ComfyUI server."""

from __future__ import annotations

import argparse
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "webapp" / "products.json"
COMFY_WORKFLOW = ROOT / "automation" / "comfyui_api_workflow.json"
GEMINI_MODEL = "gemini-2.5-flash"


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "nav", "footer", "header", "noscript"}:
            self.skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "nav", "footer", "header", "noscript"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)


def fetch_json(url: str, *, data: dict | None = None, headers: dict[str, str] | None = None,
               timeout: int = 30) -> dict:
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=request_headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read())
    except HTTPError as exc:
        raise RuntimeError(f"HTTP request failed with status {exc.code}.") from None
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"HTTP request failed: {exc.reason if isinstance(exc, URLError) else 'timed out'}.") from None
    except json.JSONDecodeError as exc:
        raise RuntimeError("The server returned invalid JSON.") from exc
    if not isinstance(result, dict):
        raise RuntimeError("The server returned an unexpected response.")
    return result


def scrape_source(source_url: str) -> str:
    parsed = urlsplit(source_url)
    if parsed.scheme != "https" or parsed.hostname != "becintegrated.com":
        raise RuntimeError("Product source URLs must use the official becintegrated.com domain.")
    request = Request(source_url, headers={"User-Agent": "BEC-Product-Content-Workflow/1.0"})
    try:
        with urlopen(request, timeout=30) as response:
            page = response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as exc:
        status = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else "network error"
        raise RuntimeError(f"Could not fetch the official product page ({status}).") from None
    parser = VisibleText()
    parser.feed(page)
    text = re.sub(r"\s+", " ", html.unescape(" ".join(parser.parts))).strip()
    if len(text) < 120:
        raise RuntimeError("The official product page did not contain enough readable text.")
    return text[:18000]


def extract_model_json(response: dict) -> dict:
    try:
        text = response["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini returned no generated campaign text.") from exc
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end < start:
            raise RuntimeError("Gemini output was not valid JSON.") from None
        try:
            result = json.loads(text[start:end + 1])
        except json.JSONDecodeError as exc:
            raise RuntimeError("Gemini output was not valid JSON.") from exc
    required = ("headline", "body", "image_prompt")
    if not isinstance(result, dict) or any(not isinstance(result.get(key), str) or not result[key].strip() for key in required):
        raise RuntimeError("Gemini output must include non-empty headline, body, and image_prompt fields.")
    return {key: result[key].strip() for key in required}


def generate_copy(api_key: str, product: dict, brief: str, source_text: str) -> dict:
    prompt = (
        "Create a factual B2B marketing draft for the product below. Use only facts in the official "
        "source text. Do not invent prices, certifications, performance numbers, compatibility, "
        "customer outcomes, or product features. Return JSON with exactly these string keys: "
        "headline, body (80-140 words), image_prompt (one realistic editorial image description). "
        "The image prompt must not request fake logos or readable text on devices/signs.\n\n"
        f"PRODUCT: {product['name']}\nCATEGORY: {product['category']}\n"
        f"CAMPAIGN BRIEF:\n{brief}\n\nOFFICIAL SOURCE TEXT:\n{source_text}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    response = fetch_json(url, data={
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
    }, headers={"x-goog-api-key": api_key}, timeout=90)
    return extract_model_json(response)


def comfyui_base_url() -> str:
    value = os.environ.get("COMFYUI_BASE_URL", "").strip().rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
        raise RuntimeError("Set COMFYUI_BASE_URL to an HTTP(S) ComfyUI API base URL without embedded credentials.")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise RuntimeError("COMFYUI_BASE_URL must be the server origin, without a path, query, or fragment.")
    return value


def generate_image(base_url: str, positive_prompt: str) -> bytes:
    checkpoint = os.environ.get("COMFYUI_CHECKPOINT", "").strip()
    if not checkpoint:
        raise RuntimeError("Set COMFYUI_CHECKPOINT to a checkpoint already installed on ComfyUI.")
    try:
        workflow = json.loads(COMFY_WORKFLOW.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("Could not load the ComfyUI API workflow template.") from exc
    workflow["4"]["inputs"]["ckpt_name"] = checkpoint
    workflow["6"]["inputs"]["text"] = positive_prompt
    workflow["7"]["inputs"]["text"] = (
        "text, watermark, logo, distorted device, extra fingers, deformed hands, "
        "unrealistic proportions, unreadable signage, clutter"
    )
    token = os.environ.get("COMFYUI_API_TOKEN", "").strip()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    queued = fetch_json(f"{base_url}/prompt", data={"prompt": workflow}, headers=headers)
    prompt_id = queued.get("prompt_id")
    if not isinstance(prompt_id, str) or not prompt_id:
        raise RuntimeError("ComfyUI did not return a prompt ID.")

    deadline = time.monotonic() + 900
    history_url = f"{base_url}/history/{prompt_id}"
    while time.monotonic() < deadline:
        history = fetch_json(history_url, headers=headers)
        entry = history.get(prompt_id)
        if isinstance(entry, dict):
            status = entry.get("status", {})
            if isinstance(status, dict) and status.get("status_str") == "error":
                raise RuntimeError("ComfyUI reported a generation error.")
            outputs = entry.get("outputs", {})
            images = [
                image
                for node_output in outputs.values()
                if isinstance(node_output, dict)
                for image in node_output.get("images", [])
                if isinstance(image, dict) and image.get("filename")
            ]
            if images:
                image = images[0]
                query = urlencode({
                    "filename": image["filename"],
                    "subfolder": image.get("subfolder", ""),
                    "type": image.get("type", "output"),
                })
                request = Request(f"{base_url}/view?{query}", headers=headers)
                try:
                    with urlopen(request, timeout=60) as response:
                        content = response.read()
                except (HTTPError, URLError, TimeoutError) as exc:
                    status = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else "network error"
                    raise RuntimeError(f"Could not download the ComfyUI output ({status}).") from None
                if not content.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise RuntimeError("ComfyUI output was not a PNG image.")
                return content
            if isinstance(status, dict) and status.get("completed"):
                raise RuntimeError("ComfyUI completed without returning an image.")
        time.sleep(3)
    raise RuntimeError("ComfyUI image generation timed out after 15 minutes.")


def escape_html(value: str) -> str:
    return html.escape(value, quote=True)


def write_campaign(out_dir: Path, product: dict, copy: dict, brief: str,
                   image: bytes, run_id: str) -> None:
    slug = re.sub(r"[^a-z0-9-]+", "-", f"{product['id']}-{run_id}".lower()).strip("-")
    campaign_dir = out_dir / "campaigns" / slug
    campaign_dir.mkdir(parents=True, exist_ok=True)
    (campaign_dir / "campaign.png").write_bytes(image)
    record = {
        "product": product,
        "campaign_brief": brief,
        "headline": copy["headline"],
        "body": copy["body"],
        "image_prompt": copy["image_prompt"],
        "source_url": product["source_url"],
    }
    (campaign_dir / "campaign.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    (campaign_dir / "campaign.md").write_text(
        f"# {copy['headline']}\n\n{copy['body']}\n\n"
        f"Product: {product['name']}\n\nSource: {product['source_url']}\n\n"
        f"Image prompt: {copy['image_prompt']}\n",
        encoding="utf-8",
    )
    page = f"""<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{escape_html(copy['headline'])}</title>
<style>body{{max-width:760px;margin:48px auto;padding:0 20px;font:17px/1.6 system-ui;color:#172a39}}img{{width:100%;border-radius:8px}}a{{color:#225d82}}</style>
<p><a href="../../index.html">BEC Product Content Studio</a></p>
<h1>{escape_html(copy['headline'])}</h1>
<img src="./campaign.png" alt="Campaign image for {escape_html(product['name'])}">
<p>{escape_html(copy['body'])}</p>
<p><a href="{escape_html(product['source_url'])}">Verify product details with BEC ↗</a></p>
<small>Generated draft. Review product claims and image before external use.</small></html>
"""
    (campaign_dir / "index.html").write_text(page, encoding="utf-8")
    print(f"Generated draft at {campaign_dir.as_posix()}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product", required=True, help="Product ID from webapp/products.json")
    parser.add_argument("--brief", required=True, help="Campaign audience, goal, and tone")
    parser.add_argument("--output", type=Path, default=Path("dist"), help="Pages artifact directory")
    parser.add_argument("--run-id", default=str(int(time.time())), help="Unique ID for this generated draft")
    args = parser.parse_args()
    if not args.brief.strip():
        parser.error("--brief cannot be empty")
    if not re.fullmatch(r"[a-zA-Z0-9-]{1,80}", args.run_id):
        parser.error("--run-id may only contain letters, numbers, and hyphens")

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Set the GEMINI_API_KEY repository secret before running this workflow.")
    base_url = comfyui_base_url()

    products = json.loads(CATALOG.read_text(encoding="utf-8"))
    product = next((item for item in products if item["id"] == args.product), None)
    if product is None:
        raise RuntimeError(f"Unknown product ID: {args.product}")

    source_text = scrape_source(product["source_url"])
    copy = generate_copy(api_key, product, args.brief, source_text)
    image = generate_image(base_url, copy["image_prompt"])
    write_campaign(args.output, product, copy, args.brief, image, args.run_id)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"Content generation failed: {exc}", file=sys.stderr)
        sys.exit(1)
