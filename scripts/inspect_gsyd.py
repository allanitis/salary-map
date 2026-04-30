import json
from pathlib import Path
g = json.load(open(Path(__file__).resolve().parent.parent / "greater-sydney.geojson"))
names = sorted({f["properties"]["SAL_NAME21"] for f in g["features"]})
print("Total features:", len(g["features"]))
print("Sample props:", g["features"][0]["properties"])
print("First 20:", names[:20])
print("Includes Penrith:", "Penrith" in names)
print("Includes Campbelltown:", any("Campbelltown" in n for n in names))
print("Includes Mosman:", "Mosman" in names)
print("Names with parens:", [n for n in names if "(" in n][:10])
print("Last 10:", names[-10:])
