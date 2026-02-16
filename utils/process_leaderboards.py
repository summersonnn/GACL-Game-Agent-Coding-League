import os
import json
import re

# Configuration
# Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(BASE_DIR, 'config')
DATA_DIR = os.path.join(BASE_DIR, 'data', 'leaderboards')
OUTPUT_FILE = os.path.join(BASE_DIR, 'data', 'leaderboard.json')
GAME_WEIGHTS_FILE = os.path.join(CONFIG_DIR, 'game_weights.txt')

GAME_MAPPING = {
    'A1': 'game1',
    'A2': 'game2',
    'A4': 'game3',
    'A5': 'game4',
    'A8': 'game5'
}

def clean_model_name(agent_name):
    """
    Clean model name by removing fp8 variants and agent suffixes.
    Replicates: modelName.replace(/-fp8-speedy/g, '').replace(/-fp8/g, '').replace(/:1$|:2$/, '')
    """
    name = agent_name
    name = name.replace('-fp8-speedy', '')
    name = name.replace('-fp8', '')
    name = re.sub(r':1$|:2$', '', name)
    return name

def load_game_weights():
    weights = {}
    
    # Defaults
    default_weights = {'game1': 1, 'game2': 1, 'game3': 1, 'game4': 1, 'game5': 1}
    
    if not os.path.exists(GAME_WEIGHTS_FILE):
        print(f"Warning: {GAME_WEIGHTS_FILE} not found. Using defaults.")
        return default_weights

    try:
        with open(GAME_WEIGHTS_FILE, 'r') as f:
            lines = f.readlines()
            
        found_any = False
        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            # Check format "A1 - 5"
            match = re.match(r'^(A\d+)\s*-\s*(\d+)$', trimmed)
            if match:
                game_code = match.group(1)
                weight = int(match.group(2))
                if game_code in GAME_MAPPING:
                    weights[GAME_MAPPING[game_code]] = weight
                    found_any = True
        
        if not found_any:
            return default_weights
            
    except Exception as e:
        print(f"Error loading weights: {e}")
        return default_weights
    
    return weights

def parse_leaderboard_file(filepath):
    """
    Parses a single leaderboard txt file.
    Format: Agent | Games | Wins | Losses | Draws | Points | Score
    """
    entries = []
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found.")
        return entries

    with open(filepath, 'r') as f:
        lines = f.readlines()

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        
        parts = [p.strip() for p in trimmed.split('|')]
        
        # Skip header or malformed lines
        if len(parts) < 7:
            continue
        if 'Agent' in parts[0]:
            continue
        
        agent_name = parts[0]
        # Skip invalid agent names (must contain :)
        if ':' not in agent_name:
            continue

        try:
            entries.append({
                'agent': agent_name,
                'games': int(parts[1]),
                'wins': int(parts[2]),
                'losses': int(parts[3]),
                'draws': int(parts[4]),
                'points': float(parts[5]),
                'score': float(parts[6])
            })
        except ValueError:
            continue
            
    return entries

def select_best_agents(entries):
    """
    Selects the best performing agent for each model.
    """
    model_best = {}
    
    for entry in entries:
        model_name = clean_model_name(entry['agent'])
        
        # If model not seen or this entry has higher score, update
        current_score = entry['score']
        
        if model_name not in model_best:
            best_entry = entry.copy()
            best_entry['model'] = model_name
            model_best[model_name] = best_entry
        else:
            if current_score > model_best[model_name]['score']:
                best_entry = entry.copy()
                best_entry['model'] = model_name
                model_best[model_name] = best_entry
            
    return list(model_best.values())

def normalize_points(entries):
    """
    Normalize points to 0-100 scale.
    """
    if not entries:
        return []
    
    points = [e['points'] for e in entries]
    if not points:
        return []
        
    max_p = max(points)
    min_p = min(points)
    p_range = max_p - min_p
    
    normalized_entries = []
    for entry in entries:
        new_entry = entry.copy()
        if p_range == 0:
            new_entry['normalized'] = 100.0
        else:
            new_entry['normalized'] = ((entry['points'] - min_p) / p_range) * 100.0
        normalized_entries.append(new_entry)
        
    return normalized_entries

def calculate_overall(game_data, weights):
    """
    Calculate weighted overall scores.
    """
    model_scores = {}
    # game_ids needs to cover all potential games
    game_ids = ['game1', 'game2', 'game3', 'game4', 'game5']
    
    # We iterate through the processed game data
    for game_id, entries in game_data.items():
        weight = weights.get(game_id, 1) # Default weight 1 if missing for some reason
        
        for entry in entries:
            model = entry['model']
            if model not in model_scores:
                model_scores[model] = {
                    'model': model,
                    'weighted_sum': 0.0,
                    'total_weight': 0.0,
                    'game_scores': {}
                }
            
            # Using normalized score
            model_scores[model]['weighted_sum'] += entry['normalized'] * weight
            model_scores[model]['total_weight'] += weight
            model_scores[model]['game_scores'][game_id] = entry['normalized']
            
    results = []
    for m, data in model_scores.items():
        avg_score = 0
        if data['total_weight'] > 0:
            avg_score = data['weighted_sum'] / data['total_weight']
            
        results.append({
            'model': m,
            'overall_score': avg_score,
            'game_scores': data['game_scores']
        })
        
    return sorted(results, key=lambda x: x['overall_score'], reverse=True)

def main():
    print("Loading weights...")
    weights = load_game_weights()
    print(f"Weights loaded: {weights}")
    
    processed_data = {
        "games": {},
        "overall": []
    }
    
    # Temporary storage for calculation
    game_best_normalized = {}
    
    # Iterate through games (game1..game5)
    for code, game_id in GAME_MAPPING.items():
        filename = f"{code}-scoreboard.txt"
        path = os.path.join(DATA_DIR, filename)
        
        print(f"Processing {game_id} ({filename})...")
        raw_entries = parse_leaderboard_file(path)
        
        if not raw_entries:
            print(f"  No entries found for {game_id}")
            processed_data["games"][game_id] = []
            continue
            
        # Select best agent per model
        best_agents = select_best_agents(raw_entries)
        
        # Normalize
        normalized_agents = normalize_points(best_agents)
        
        # Sort descending by normalized score
        normalized_agents.sort(key=lambda x: x['normalized'], reverse=True)
        
        # Store
        processed_data["games"][game_id] = normalized_agents
        game_best_normalized[game_id] = normalized_agents
        
    # Calculate overall
    print("Calculating overall scores...")
    overall_scores = calculate_overall(game_best_normalized, weights)
    processed_data["overall"] = overall_scores
    
    # Write output
    print(f"Writing parsed data to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(processed_data, f, indent=2)
        
    print("Done.")

if __name__ == "__main__":
    main()
