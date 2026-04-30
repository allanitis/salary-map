"""Generate a JS file mapshaper can -include to filter SAL features by code.

mapshaper -include expects an object literal mapping name -> value/function.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TSV = ROOT / "abs" / "greater_sydney_sal.tsv"
OUT = ROOT / "abs" / "gsyd_filter.js"

codes = []
for line in TSV.read_text(encoding="utf-8").splitlines():
    if not line.strip(): continue
    code, _name = line.split("\t", 1)
    codes.append(code)

# Object literal for `-include`. Expose a Set on a property and a helper.
js = (
    "{\n"
    f"  GSYD_CODES: new Set({json.dumps(codes)}),\n"
    "  inGSYD: function(c) { return this.GSYD_CODES.has(c); }\n"
    "}\n"
)
OUT.write_text(js, encoding="utf-8")
print(f"Wrote {OUT} with {len(codes)} codes")
