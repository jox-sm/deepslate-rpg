import json, sys
from pathlib import Path
from graphify.extract import collect_files

detect = json.loads(Path('graphify-out/.graphify_incremental.json').read_text())

# Collect all new/changed files (code + docs)
all_files = []
for files in detect.get('new_files', {}).values():
    for f in files:
        all_files.extend(collect_files(Path(f)) if Path(f).is_dir() else [Path(f)])

# Split into chunks of 20-25 files
chunk_size = 22
chunks = []
for i in range(0, len(all_files), chunk_size):
    chunks.append(all_files[i:i+chunk_size])

print(f"Total files: {len(all_files)}")
print(f"Chunks: {len(chunks)}")
for i, chunk in enumerate(chunks):
    print(f"Chunk {i+1}: {len(chunk)} files")
    for f in chunk:
        print(f"  {f}")

# Write chunk info
Path('graphify-out/.graphify_chunks.json').write_text(json.dumps({
    'total_files': len(all_files),
    'chunks': [[str(f) for f in chunk] for chunk in chunks]
}, indent=2))
