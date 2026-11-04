# BEC Product Content Studio

Static, dependency-free product catalog and campaign brief builder. The catalog
is based on product names and descriptions published at
[becintegrated.com](https://becintegrated.com/); each product links back to its
official source page. Product setup diagrams and device images are locally
bundled from BEC's published product pages or the supplied BEC product
references. System images are representative; project-specific equipment
should be confirmed with BEC.

## Local preview

Open `index.html` from a local HTTP server (the browser fetches `products.json`):

```powershell
python -m http.server 8000 --directory webapp
```

Then open `http://localhost:8000`.

The brief builder does not store or transmit credentials. It copies a product
ID and campaign brief, then opens the protected GitHub Actions workflow for
manual dispatch.

## GitHub Pages

`.github/workflows/pages.yml` publishes only this directory. The deployment
workflow can enable Pages when it has repository Actions permissions. After the
first successful deployment, the default project URL is
`https://calina-miguel.github.io/BEC/`.

## Content-generation workflow setup

The manual workflow scrapes the selected official BEC product page, asks Gemini
for a factual copy draft and image prompt, submits that prompt to a configured
ComfyUI API server, and publishes the generated page after the
`content-review` environment approval.

Before dispatching a run, configure these repository Actions secrets:

- `GEMINI_API_KEY`: Google AI Studio API key.
- `COMFYUI_BASE_URL`: reachable ComfyUI HTTP(S) server origin (without a path).
- `COMFYUI_CHECKPOINT`: checkpoint filename already installed on that server.
- `COMFYUI_API_TOKEN`: optional bearer token if the ComfyUI endpoint is behind a
  bearer-token proxy.

The API-format workflow in `automation/comfyui_api_workflow.json` uses standard
ComfyUI nodes; the configured server must have the selected checkpoint and
support those nodes. Do not expose an unauthenticated ComfyUI server to the
public internet.

For a real approval gate, add required reviewers to the repository's
`content-review` environment in **Settings → Environments**. Without that
repository-side protection, GitHub does not pause the workflow for approval.
The generated draft and image are available as a workflow artifact for review.

The static page cannot dispatch Actions anonymously; no personal access token
is embedded in the site. Select **Copy brief & open workflow**, then choose the
product and paste the campaign brief into the protected workflow form.
