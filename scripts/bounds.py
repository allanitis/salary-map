import json
from pathlib import Path
g = json.load(open(Path(__file__).resolve().parent.parent / "sydney" / "greater-sydney.geojson"))
xs, ys = [], []
def walk(c):
    if isinstance(c[0], (int, float)):
        xs.append(c[0]); ys.append(c[1])
    else:
        for x in c: walk(x)
for f in g["features"]:
    walk(f["geometry"]["coordinates"])
print(f"lon {min(xs):.4f} .. {max(xs):.4f}")
print(f"lat {min(ys):.4f} .. {max(ys):.4f}")
