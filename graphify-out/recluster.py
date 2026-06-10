"""Re-cluster and regenerate outputs for updated graph."""
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html

data = json.loads(Path("graphify-out/graph.json").read_text())
G = json_graph.node_link_graph(data, edges="edges")

detection = {
    "total_files": 320, "total_words": 270357,
    "needs_graph": True, "warning": None,
    "files": {"code": [], "document": [], "paper": []},
}
tokens = {"input": 0, "output": 0}

communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)

# Label communities
labels_raw = {}
if Path("graphify-out/.graphify_labels.json").exists():
    labels_raw = json.loads(Path("graphify-out/.graphify_labels.json").read_text())
labels = {int(k): v for k, v in labels_raw.items()}

report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, ".")
Path("graphify-out/GRAPH_REPORT.md").write_text(report)

to_json(G, communities, "graphify-out/graph.json")
to_html(G, communities, "graphify-out/graph.html", community_labels=labels or None)

analysis = {
    "communities": {str(k): v for k, v in communities.items()},
    "cohesion": {str(k): v for k, v in cohesion.items()},
    "gods": gods,
    "surprises": surprises,
}
Path("graphify-out/.graphify_analysis.json").write_text(json.dumps(analysis, indent=2))

print(f"Re-clustered: {len(communities)} communities")
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"God nodes: {len(gods)}")
print(f"Surprising connections: {len(surprises)}")
print("Outputs: graph.json, graph.html, GRAPH_REPORT.md, .graphify_analysis.json")
