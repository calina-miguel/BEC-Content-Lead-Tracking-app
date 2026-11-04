# BEC Product Content Studio

This repository contains the BEC product-selection site and its optional
content-generation workflow.

- [`webapp/`](./webapp/) contains the static catalog, BEC product imagery, and
  campaign brief builder.
- [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) publishes the
  `webapp/` directory to GitHub Pages.
- [`automation/`](./automation/) contains the manual content-generation
  workflow and tests.

See [`webapp/README.md`](./webapp/README.md) for local preview and setup
instructions. The Pages site is expected at
<https://calina-miguel.github.io/BEC/> after the first successful deployment.
