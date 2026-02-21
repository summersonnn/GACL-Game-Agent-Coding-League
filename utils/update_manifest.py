import os
import json
import re
from datetime import datetime

# Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS_DIR = os.path.join(BASE_DIR, 'docs', 'data', 'runs')
MANIFEST_FILE = os.path.join(BASE_DIR, 'docs', 'data', 'runs.json')
CONFIG_FILE = os.path.join(BASE_DIR, 'docs', 'data', 'config.json')

def main():
    if not os.path.exists(RUNS_DIR):
        print(f"Error: Directory '{RUNS_DIR}' not found.")
        return

    # Load game config to know what games to look for
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            games = [g['id'] for g in config.get('games', [])]
    except Exception as e:
        print(f"Error loading config: {e}")
        return

    runs = []
    
    # 1. Check for the "Latest" set (gameX_results.txt)
    # These text files match the format expected by parseTXT in main.js
    latest_files = {}
    missing_latest = False
    
    # Check if we have files for all games
    for game_id in games:
        filename = f"{game_id}_results.txt"
        if os.path.exists(os.path.join(RUNS_DIR, filename)):
            latest_files[game_id] = filename
        else:
            # If any game file is missing, we might still want to show partial results
            # But main.js handles missing files gracefully (logs warning), 
            # so we can include partial sets too.
            pass
            
    if latest_files:
        # Get modification time of one of the files for the date
        first_file = list(latest_files.values())[0]
        timestamp = os.path.getmtime(os.path.join(RUNS_DIR, first_file))
        date_str = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
        
        runs.append({
            "name": "Latest Results",
            "date": date_str,
            "timestamp": timestamp,
            "files": latest_files
        })
        print("Found 'Latest Results' set.")

    # 3. Future proofing: Check for timestamped sets if we add them later
    # Pattern: game1_results_YYYYMMDD_HHMMSS.txt
    
    # Sort runs by date descending
    runs.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # Remove temporary timestamp field
    for r in runs:
        if 'timestamp' in r:
            del r['timestamp']

    # Write to JSON
    with open(MANIFEST_FILE, 'w') as f:
        json.dump({"runs": runs}, f, indent=2)
    
    print(f"\nSuccessfully updated {MANIFEST_FILE} with {len(runs)} runs.")

if __name__ == "__main__":
    main()