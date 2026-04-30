import json, os
p = json.load(open('prices.json'))
print('Suburbs:', len(p))
print('With house median:', sum(1 for v in p.values() if 'house' in v))
print('With unit median:', sum(1 for v in p.values() if 'unit' in v))
samples = ['MOSMAN','BONDI','PARRAMATTA','PENRITH','BLACKTOWN','VAUCLUSE','SURRY HILLS','CHATSWOOD','LIVERPOOL','RANDWICK','BONDI BEACH']
for s in samples:
    print(f'  {s}: {p.get(s)}')
print('File size:', os.path.getsize('prices.json'), 'bytes')
