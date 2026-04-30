"""Build prices.json from NSW property sales CSV.

Strategy:
- Read sales CSV in chunks
- Keep only sales whose `Property locality` matches a Sydney SAL suburb (case-insensitive)
- Use sales with contract date in the last N months (default 18) for a recent median
- Classify dwelling type:
    unit  = strata lot number present (i.e. strata-titled apartment/townhouse)
    house = residential, no strata
- Drop vacant land (Nature of property = V) and non-residential primary purposes
- Compute median per (suburb, type) where n >= 8
"""

import csv
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
GEOJSON = ROOT / "greater-sydney.geojson"
# Find any nsw-property-sales*.csv in data/
_csvs = sorted((ROOT / "data").glob("nsw-property-sales*.csv"))
SALES_CSV = _csvs[-1] if _csvs else (ROOT / "data" / "nsw-property-sales-data.csv")
OUT = ROOT / "prices.json"
NAME_FIELD = "SAL_NAME21"

LOOKBACK_MONTHS = 18
MIN_SAMPLE = 8

def load_sydney_suburbs():
    g = json.loads(GEOJSON.read_text(encoding="utf-8"))
    # SSC_NAME may be like "Abbotsford (NSW)" - strip the parenthetical
    names = set()
    raw_to_clean = {}
    for f in g["features"]:
        raw = f["properties"][NAME_FIELD]
        clean = raw.split(" (")[0].strip().upper()
        names.add(clean)
        raw_to_clean[raw] = clean
    return names, raw_to_clean

def is_residential(nature_of_prop, primary_purpose):
    # Nature of property: R=residential, V=vacant, 3 etc
    pp = (primary_purpose or "").upper()
    if nature_of_prop != "R":
        # Sometimes blank; fall back to primary purpose check
        if not any(k in pp for k in ("RESIDENCE", "DWELLING", "HOUSE", "UNIT", "FLAT", "APARTMENT", "TOWNHOUSE", "VILLA", "DUPLEX", "TERRACE", "RESIDENTIAL")):
            return False
    if any(k in pp for k in ("COMMERCIAL", "INDUSTRIAL", "VACANT", "RURAL", "FARM", "RETAIL", "OFFICE", "WAREHOUSE", "FACTORY")):
        return False
    return True

def classify(strata_lot, primary_purpose):
    pp = (primary_purpose or "").upper()
    has_strata = bool((strata_lot or "").strip())
    if has_strata:
        return "unit"
    if any(k in pp for k in ("UNIT", "FLAT", "APARTMENT", "TOWNHOUSE", "VILLA")):
        return "unit"
    return "house"

def main():
    suburbs, raw_to_clean = load_sydney_suburbs()
    print(f"Loaded {len(suburbs)} Sydney suburbs from GeoJSON", file=sys.stderr)

    # Use today's date - LOOKBACK_MONTHS (approx)
    cutoff = datetime.now() - timedelta(days=LOOKBACK_MONTHS * 30)
    print(f"Including sales with contract date >= {cutoff.date()}", file=sys.stderr)

    buckets = defaultdict(list)  # (suburb_clean, type) -> [price, ...]

    n_rows = 0
    n_match = 0
    with SALES_CSV.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            n_rows += 1
            if n_rows % 500_000 == 0:
                print(f"  scanned {n_rows:,} rows, matched {n_match:,}", file=sys.stderr)

            locality = (row.get("Property locality") or "").strip().upper()
            if locality not in suburbs:
                continue

            # Parse price
            try:
                price = float(row.get("Purchase price") or 0)
            except ValueError:
                continue
            if price < 100_000 or price > 50_000_000:
                continue

            # Parse contract date (YYYY-MM-DD)
            cd = (row.get("Contract date") or "").strip()
            if not cd:
                continue
            try:
                dt = datetime.strptime(cd, "%Y-%m-%d")
            except ValueError:
                continue
            if dt < cutoff:
                continue

            if not is_residential(row.get("Nature of property", ""), row.get("Primary purpose", "")):
                continue

            dtype = classify(row.get("Strata lot number", ""), row.get("Primary purpose", ""))
            buckets[(locality, dtype)].append(price)
            n_match += 1

    print(f"Scanned {n_rows:,} rows, matched {n_match:,}", file=sys.stderr)

    # Build output keyed by clean (uppercase) suburb name
    out = {}
    for (suburb, dtype), prices in buckets.items():
        if len(prices) < MIN_SAMPLE:
            continue
        rec = out.setdefault(suburb, {})
        rec[dtype] = int(median(prices))
        rec[f"n_{dtype}"] = len(prices)

    print(f"Suburbs with at least one type: {len(out)}", file=sys.stderr)

    OUT.write_text(json.dumps(out, indent=1, sort_keys=True))
    print(f"Wrote {OUT}", file=sys.stderr)

if __name__ == "__main__":
    main()
