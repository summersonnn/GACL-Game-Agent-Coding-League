import os
import json
import re
from datetime import datetime

# Configuration
RUNS_DIR = 'data/runs'
MANIFEST_FILE = 'data/runs.json'

def get_date_from_filename(filename):
    # Tries to match YYYYMMDD_HHMMSS format from main.js logic
    match = re.search(r'(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})', filename)
    if match:
        y, m, d, H, M, S = match.groups()
        return f"{y}-{m}-{d} {H}:{M}:{S}"
    
    # Fallback: Use file modification time if filename doesn't match
    timestamp = os.path.getmtime(os.path.join(RUNS_DIR, filename))
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

def main():
    if not os.path.exists(RUNS_DIR):
        print(f"Error: Directory '{RUNS_DIR}' not found.")
        return

    runs = []
    print(f"Scanning {RUNS_DIR}...")

    # listdir gives arbitrary order; sort by name usually sorts by date for these filenames
    files = sorted(os.listdir(RUNS_DIR), reverse=True)

    for f in files:
        if f.endswith('.html'):
            date_str = get_date_from_filename(f)
            runs.append({
                "file": f,
                "date": date_str
            })
            print(f"  Found: {f} ({date_str})")

    # Write to JSON
    with open(MANIFEST_FILE, 'w') as f:
        json.dump({"runs": runs}, f, indent=2)
    
    print(f"\nSuccessfully updated {MANIFEST_FILE} with {len(runs)} runs.")

if __name__ == "__main__":
    main()