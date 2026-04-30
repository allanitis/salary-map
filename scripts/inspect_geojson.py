import json
with open('sydney.geojson','r') as f:
    g = json.load(f)
names = sorted({feat['properties'].get('SSC_NAME') for feat in g['features']})
print('Total features:', len(g['features']))
print('Unique suburbs:', len(names))
print('First 30:', names[:30])
print('Sample feature props:', g['features'][0]['properties'])
