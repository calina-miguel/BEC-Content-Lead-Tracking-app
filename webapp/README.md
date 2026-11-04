# BEC Content & Lead Tracking app

A static product catalog and browser-based lead tracker for demonstrating BEC
Integrated Solutions products.

## Try the demo

Open the published app at
<https://calina-miguel.github.io/BEC-Content-Lead-Tracking-app/> or preview it
locally with a small HTTP server:

```powershell
python -m http.server 8000 --directory webapp
```

Then open `http://localhost:8000`.

1. Browse or search the product catalog and inspect the representative setup
   images.
2. Scroll to **Keep every enquiry moving**. Three clearly labeled sample leads
   are provided on a first visit.
3. Add a lead with a name, organization, product, and at least one contact
   method. Update its status, search or filter the list, or remove it.
4. Choose **Download CSV** to export the current list. **Restore demo records**
   replaces the saved list with the sample records.

## Data and publishing

Lead records are stored only in this browser on this device. They are not sent
to a server or shared with other users. Clearing browser data removes them;
download a CSV before switching devices or browsers. Sample people and
organizations are fictional.

Product setup images are representative and configurations vary by project.
Confirm specifications and package contents with BEC before making a purchasing
decision.

The GitHub Pages workflow publishes the `webapp/` directory. The CI workflow
checks the product catalog and required app files on each change.
