"""Update graph.json with new auth nodes without AST extraction."""
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

old_path = Path("graphify-out/.graphify_old.json")
data = json.loads(old_path.read_text())
G = json_graph.node_link_graph(data, edges="links")

# New nodes for the authorization system
new_nodes = {
    "convex_games_fixed": {
        "label": "games.ts — fixed import + auth guards",
        "file_type": "code",
        "source_file": "convex/games.ts",
        "source_location": "convex/games.ts",
    },
    "convex_schema_ownerid": {
        "label": "schema.ts — ownerId fields + staff table",
        "file_type": "code",
        "source_file": "convex/schema.ts",
        "source_location": "convex/schema.ts",
    },
    "convex_authHelpers": {
        "label": "authHelpers.ts — requireAuth() + requireStaff()",
        "file_type": "code",
        "source_file": "convex/authHelpers.ts",
        "source_location": "convex/authHelpers.ts",
    },
    "convex_staff": {
        "label": "staff.ts — staff table CRUD + getStaffDegree",
        "file_type": "code",
        "source_file": "convex/staff.ts",
        "source_location": "convex/staff.ts",
    },
    "convex_characters_auth": {
        "label": "characters.ts — auth guards added",
        "file_type": "code",
        "source_file": "convex/characters.ts",
        "source_location": "convex/characters.ts",
    },
    "convex_maps_auth": {
        "label": "maps.ts — auth guards added",
        "file_type": "code",
        "source_file": "convex/maps.ts",
        "source_location": "convex/maps.ts",
    },
    "convex_items_auth": {
        "label": "items.ts — auth guards added",
        "file_type": "code",
        "source_file": "convex/items.ts",
        "source_location": "convex/items.ts",
    },
    "security_constants": {
        "label": "security/constants.ts — STAFF_DEGREE + ROLE_TTL",
        "file_type": "code",
        "source_file": "utilities/security/constants.ts",
        "source_location": "utilities/security/constants.ts",
    },
    "security_types": {
        "label": "security/types.ts — StaffRecord + AuthorizationResult",
        "file_type": "code",
        "source_file": "utilities/security/types.ts",
        "source_location": "utilities/security/types.ts",
    },
    "security_authorize": {
        "label": "security/authorize.ts — hasMinimumDegree + isStaff",
        "file_type": "code",
        "source_file": "utilities/security/authorize.ts",
        "source_location": "utilities/security/authorize.ts",
    },
    "requireAuth": {
        "label": "requireAuth() — identity gate wrapper",
        "file_type": "code",
        "source_file": "convex/authHelpers.ts",
        "source_location": "convex/authHelpers.ts",
    },
    "requireStaff": {
        "label": "requireStaff() — role-based auth gate",
        "file_type": "code",
        "source_file": "convex/authHelpers.ts",
        "source_location": "convex/authHelpers.ts",
    },
    "getStaffDegree": {
        "label": "getStaffDegree — role lookup query",
        "file_type": "code",
        "source_file": "convex/staff.ts",
        "source_location": "convex/staff.ts",
    },
    "STAFF_DEGREE": {
        "label": "STAFF_DEGREE enum — user(0) to superAdmin(4)",
        "file_type": "code",
        "source_file": "utilities/security/constants.ts",
        "source_location": "utilities/security/constants.ts",
    },
    "ownerId_field": {
        "label": "ownerId — ownership field on all tables",
        "file_type": "code",
        "source_file": "convex/schema.ts",
        "source_location": "convex/schema.ts",
    },
    "tokenIdentifier_auth": {
        "label": "identity.tokenIdentifier — canonical auth key",
        "file_type": "document",
        "source_file": "convex/_generated/ai/guidelines.md",
        "source_location": "convex/_generated/ai/guidelines.md",
    },
    "convex_auth_issue": {
        "label": "Issue: Convex authorization — closed",
        "file_type": "document",
        "source_file": "documentations/issues/convex-authorization.md",
        "source_location": "documentations/issues/convex-authorization.md",
    },
}

# Add nodes
for nid, ndata in new_nodes.items():
    if nid not in G:
        G.add_node(nid, **ndata)

# Add edges connecting new nodes to existing nodes
edges = [
    # authHelpers connects to games, characters, maps, items
    ("convex_authHelpers", "convex_games_fixed", "implements", "INFERRED", 0.9),
    ("convex_authHelpers", "convex_characters_auth", "implements", "INFERRED", 0.9),
    ("convex_authHelpers", "convex_maps_auth", "implements", "INFERRED", 0.9),
    ("convex_authHelpers", "convex_items_auth", "implements", "INFERRED", 0.9),
    # schema connects to all tables
    ("convex_schema_ownerid", "convex_games_fixed", "defines", "EXTRACTED", 1.0),
    ("convex_schema_ownerid", "convex_characters_auth", "defines", "EXTRACTED", 1.0),
    ("convex_schema_ownerid", "convex_maps_auth", "defines", "EXTRACTED", 1.0),
    ("convex_schema_ownerid", "convex_items_auth", "defines", "EXTRACTED", 1.0),
    # staff + authHelpers connection
    ("convex_staff", "convex_authHelpers", "used_by", "EXTRACTED", 1.0),
    # security utilities
    ("security_constants", "convex_authHelpers", "shared_with", "EXTRACTED", 1.0),
    ("security_types", "security_constants", "references", "EXTRACTED", 1.0),
    ("security_authorize", "security_constants", "depends_on", "EXTRACTED", 1.0),
    # function to file connections
    ("requireAuth", "convex_authHelpers", "defined_in", "EXTRACTED", 1.0),
    ("requireStaff", "convex_authHelpers", "defined_in", "EXTRACTED", 1.0),
    ("getStaffDegree", "convex_staff", "defined_in", "EXTRACTED", 1.0),
    # tokenIdentifier is the key auth concept
    ("tokenIdentifier_auth", "convex_authHelpers", "used_by", "EXTRACTED", 1.0),
    ("tokenIdentifier_auth", "convex_games_fixed", "used_by", "EXTRACTED", 1.0),
    ("tokenIdentifier_auth", "convex_characters_auth", "used_by", "EXTRACTED", 1.0),
    ("tokenIdentifier_auth", "convex_maps_auth", "used_by", "EXTRACTED", 1.0),
    ("tokenIdentifier_auth", "convex_items_auth", "used_by", "EXTRACTED", 1.0),
    ("tokenIdentifier_auth", "ownerId_field", "maps_to", "EXTRACTED", 1.0),
    # issue document
    ("convex_auth_issue", "convex_games_fixed", "documents", "EXTRACTED", 1.0),
    ("convex_auth_issue", "convex_schema_ownerid", "documents", "EXTRACTED", 1.0),
    ("convex_auth_issue", "convex_authHelpers", "documents", "EXTRACTED", 1.0),
    ("convex_auth_issue", "convex_staff", "documents", "EXTRACTED", 1.0),
    ("convex_auth_issue", "security_constants", "documents", "EXTRACTED", 1.0),
    # Connect to existing graph nodes
    ("convex_games_fixed", "games_create", "implements", "INFERRED", 0.85),
    ("ownerId_field", "games_ownerId", "defines", "INFERRED", 0.8),
]

# Find existing related nodes to connect to
existing_convex_nodes = [n for n in G.nodes if "convex" in G.nodes[n].get("label", "").lower() or "Convex" in G.nodes[n].get("label", "")]
print(f"Found {len(existing_convex_nodes)} existing convex-related nodes")

# Add the defined edges
for src, tgt, relation, confidence, score in edges:
    if src in G and tgt in G:
        G.add_edge(src, tgt, relation=relation, confidence=confidence, confidence_score=score, weight=1.0)

print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

# Save updated graph
out_data = json_graph.node_link_data(G)
Path("graphify-out/graph.json").write_text(json.dumps(out_data, indent=2))
print("graph.json updated")

# Remove old backup
Path("graphify-out/.graphify_old.json").unlink(missing_ok=True)
