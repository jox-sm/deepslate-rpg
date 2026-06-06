import json, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

a = json.loads(Path('graphify-out/.graphify_analysis.json').read_text())
comm = a['communities']
graph_data = json.loads(Path('graphify-out/graph.json').read_text())
node_map = {n['id']: n['label'] for n in graph_data['nodes']}

for k in sorted(comm.keys(), key=int):
    members = comm[k]
    labels = [node_map.get(nid, nid) for nid in members[:10]]
    print(f'Community {k} ({len(members)} nodes): {", ".join(labels[:6])}')
