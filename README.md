# Sydney Salary Affordability Map

Static web app. Adjust salary, interest rate, deposit, and house/unit toggle. Suburbs colour by stressed mortgage repayment as a percentage of take-home pay.

Live: https://allanitis.github.io/salary-map/

## Coverage

923 Greater Sydney suburbs (ABS GCCSA `1GSYD`), of which 814 have a recent median for at least one dwelling type. Includes Penrith, Campbelltown, Blue Mountains, Central Coast, Wollondilly, Hawkesbury — full ABS Greater Sydney footprint.

## Files

- `index.html` / `app.js` — the app (vanilla Leaflet, no build step)
- `greater-sydney.geojson` — 923 SAL polygons, simplified, ~770 KB
- `prices.json` — house & unit median prices per suburb
- `scripts/build_prices.py` — rebuild `prices.json` from a fresh sales CSV
- `scripts/build_greater_sydney_sals.py` — rebuild SAL → GCCSA filter list
- `scripts/write_filter_js.py` — emit mapshaper filter include

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Affordability formula

- Loan = price × (1 − deposit %)
- Stressed rate = slider rate + 3% (APRA serviceability buffer)
- Monthly repayment = standard P&I, 30-year term
- Take-home = gross − ATO 2024-25 resident tax − 2% Medicare
- Ratio = monthly repayment / monthly take-home

Colour scale: green ≤30%, yellow 30-40%, red ≥40%.

## Refresh prices

`https://nswpropertysalesdata.com/data/archive.zip` updates daily ~5am AEST.

```bash
mkdir -p data && curl -o nsw_sales.zip https://nswpropertysalesdata.com/data/archive.zip
unzip -o nsw_sales.zip -d data/
python scripts/build_prices.py
git add prices.json && git commit -m "refresh medians" && git push
```

GitHub Pages will auto-rebuild.

## Rebuild the suburb boundaries (one-off)

```bash
mkdir -p abs && cd abs
curl -O https://www.abs.gov.au/.../SAL_2021_AUST_GDA2020_SHP.zip
curl -O https://www.abs.gov.au/.../SAL_2021_AUST.xlsx
curl -O https://www.abs.gov.au/.../MB_2021_AUST.xlsx
unzip SAL_2021_AUST_GDA2020_SHP.zip
cd ..
python scripts/build_greater_sydney_sals.py
python scripts/write_filter_js.py
cd abs && mapshaper -i SAL_2021_AUST_GDA2020.shp \
  -include gsyd_filter.js \
  -filter 'GSYD_CODES.has(SAL_CODE21)' \
  -simplify 8% keep-shapes -clean \
  -o format=geojson precision=0.0001 ../greater-sydney.geojson
```

(Source data in `abs/` is 150 MB and gitignored; it's only needed to rebuild the boundaries.)

## Deploy

```bash
gh repo create salary-map --public --source=. --push
gh api -X POST repos/{owner}/salary-map/pages -f "source[branch]=main" -f "source[path]=/"
```

Cloudflare Pages or Netlify drag-drop also work.

## Known limits

- Suburb-name match: where a suburb name is duplicated elsewhere in NSW (e.g. multiple "Springwood"s), sales from outside Greater Sydney can leak into the median. v2 should match by postcode.
- Townhouses on strata title get bucketed as units.
- Tax assumes single-borrower 2024-25 ATO resident rates + 2% Medicare. No HECS/private health surcharge. For couples, enter combined gross.
- All-Australia coverage isn't free: only NSW publishes bulk sales data openly.
