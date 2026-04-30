# Sydney Salary Affordability Map

Static web app. Adjust salary, interest rate, deposit, and house/unit toggle. Suburbs colour by stressed mortgage repayment as a percentage of take-home pay.

## Files

- `index.html` / `app.js` — the app
- `sydney.geojson` — 494 Sydney suburb polygons (from [tim-massey/sydney-geojson](https://github.com/tim-massey/sydney-geojson))
- `prices.json` — house & unit median prices per suburb, computed from the last 18 months of NSW Valuer General sales (≥8 sales per suburb/type)
- `scripts/build_prices.py` — rebuild `prices.json` from a fresh sales CSV
- `scripts/check_prices.py` — sanity-check output

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Deploy free (GitHub Pages)

```bash
cd C:/Users/Matt/projects/salary-map
git init
git add index.html app.js sydney.geojson prices.json README.md
git commit -m "Sydney salary affordability map"
gh repo create salary-map --public --source=. --push
gh api -X POST repos/{owner}/salary-map/pages -f "build_type=workflow" -f "source[branch]=main" -f "source[path]=/"
```

Or simpler: push the repo, then in GitHub web UI → Settings → Pages → Source: `main` branch / root.

Cloudflare Pages or Netlify drop-zone work just as well — point them at the repo or drag-drop the folder.

## Affordability formula

- Loan = price × (1 − deposit %)
- Stressed rate = slider rate + 3% (APRA serviceability buffer)
- Monthly repayment = standard P&I, 30-year term
- Take-home = gross − ATO 2024-25 resident tax − 2% Medicare
- Ratio = monthly repayment / monthly take-home

Colour scale: green ≤30%, yellow 30-40%, red ≥40%.

## Refreshing prices

`https://nswpropertysalesdata.com/data/archive.zip` updates daily ~5am AEST. To refresh:

```bash
curl -o nsw_sales.zip https://nswpropertysalesdata.com/data/archive.zip
unzip -o nsw_sales.zip -d data/
python scripts/build_prices.py
```

## Known limits

- Coverage is metropolitan Sydney only (~494 suburbs). Outer west (e.g. Penrith) and far-flung areas not in this GeoJSON.
- Strata classification is a proxy: a strata-titled property is classed as a unit. Townhouses on strata title get bucketed as units.
- Median is over the last 18 months; thinly-traded suburbs are dropped.
