# Game Agent Coding League for LLMs - Project Documentation

## Overview

A static website for displaying LLM performance across coding game challenges. The site parses simple TXT files containing model scores and presents the data in interactive bar charts.

## Tech Stack

| Technology | Purpose | CDN |
|------------|---------|-----|
| **Tailwind CSS** | Utility-first styling | `https://cdn.tailwindcss.com` |
| **Chart.js 4.4.1** | Bar chart visualization | `https://cdn.jsdelivr.net/npm/chart.js@4.4.1` |
| **Vanilla JavaScript** | TXT parsing, application logic | N/A |

No build step required. All dependencies loaded via CDN.

## Project Structure

```
/
├── index.html                 # Main page with game tabs
├── css/
│   └── styles.css             # Custom styles
├── js/
│   └── main.js                # Core application logic
├── data/
│   ├── config.json            # Game configuration with weights
│   ├── runs.json              # Manifest listing available benchmark runs
│   └── runs/                  # Directory containing game result TXT files
│       ├── game1_results.txt
│       ├── game2_results.txt
│       └── ...
└── CLAUDE.md                  # This documentation file
```

## Data Format

### Game Configuration (`data/config.json`)

Defines the games and their weights for overall scoring:

```json
{
  "games": [
    {
      "id": "game1",
      "name": "Game 1",
      "weight": 1.0
    },
    {
      "id": "game2",
      "name": "Game 2",
      "weight": 1.0
    }
  ]
}
```

**Weight:** Used to calculate weighted average for overall performance. Adjust weights to emphasize specific games.

### Runs Manifest (`data/runs.json`)

Lists available benchmark runs and their corresponding data files:

```json
{
  "runs": [
    {
      "name": "Feb 15th 2026",
      "date": "2026-02-15",
      "files": {
        "game1": "game1_results.txt",
        "game2": "game2_results.txt",
        "game3": "game3_results.txt",
        "game4": "game4_results.txt",
        "game5": "game5_results.txt"
      }
    }
  ]
}
```

### Game Results TXT Format

Each game results file follows a simple format:

```
Model Name 1 - 92
Model Name 2 - 88
Model Name 3 - 85
```

**Format Rules:**
- One model per line
- Format: `Model Name - Points`
- Points can be integers or decimals (e.g., `92.5`)
- Empty lines are ignored
- Whitespace around the hyphen is flexible

## Features

### 1. Overall Tab

Displays weighted average performance across all games:
- Calculates `(Game1*W1 + Game2*W2 + ... + GameN*WN) / (W1 + W2 + ... + WN)`
- Models sorted by overall score (highest first)
- Horizontal bar chart with gradient colors

### 2. Individual Game Tabs (Game 1-5)

Each tab shows performance for a single game:
- Models sorted by points (highest first)
- Horizontal bar chart
- Color gradient from best to worst

### 3. Run Selector

Sidebar navigation to switch between different benchmark runs:
- Click a run to load its data
- Currently selected run is highlighted
- Automatically loads first run on page load

## Score Calculation

### Overall Score
- Weighted average: `Overall = Σ(GameScore × Weight) / Σ(Weight)`
- With all weights = 1.0: `Overall = (Game1 + Game2 + ... + Game5) / 5`
- Models missing from a game are excluded from that game's contribution

### Per-Game Score
- Direct points from TXT file
- No normalization or scaling applied

## Styling

### Chart Colors
- Gradient from teal (best) to gray (worst)
- Automatically generated based on number of models
- Consistent across all tabs

### Layout
- Responsive sidebar navigation
- Main content area with tab system
- Charts use full available height (500px)
- Horizontal bars for better model name readability

## Adding New Benchmark Runs

1. Create TXT files for each game with format: `Model Name - Points`
2. Place TXT files in `data/runs/` directory
3. Update `data/runs.json` manifest:
   ```json
   {
     "runs": [
       {
         "name": "New Run Name",
         "date": "2026-02-20",
         "files": {
           "game1": "new_game1_results.txt",
           "game2": "new_game2_results.txt",
           "game3": "new_game3_results.txt",
           "game4": "new_game4_results.txt",
           "game5": "new_game5_results.txt"
         }
       }
     ]
   }
   ```
4. Refresh the page

## Adjusting Game Weights

To emphasize certain games over others, edit `data/config.json`:

```json
{
  "games": [
    {
      "id": "game1",
      "name": "Game 1",
      "weight": 2.0  // Game 1 counts twice as much
    },
    {
      "id": "game2",
      "name": "Game 2",
      "weight": 1.0  // Standard weight
    }
  ]
}
```

**Example:** With weights [2.0, 1.0, 1.0, 1.0, 1.0], the overall score becomes:
`(Game1*2 + Game2 + Game3 + Game4 + Game5) / 6`

## Key Functions in `main.js`

| Function | Purpose |
|----------|---------|
| `init()` | Application entry point |
| `loadConfig()` | Fetches `config.json` |
| `loadManifest()` | Fetches `runs.json` |
| `loadRun(run)` | Loads all TXT files for a run |
| `parseTXT(text)` | Parses TXT format into structured data |
| `renderOverallChart(gameData)` | Renders weighted overall chart |
| `renderGameChart(gameId, gameName, data)` | Renders individual game chart |
| `renderChart(canvasId, label, labels, scores)` | Generic Chart.js renderer |
| `generateBarColors(count)` | Creates color gradient |

## Hosting

Designed for static hosting (GitHub Pages, Netlify, etc.). No server-side processing required.

Since JavaScript cannot scan directories on static hosting, the `data/runs.json` manifest must be manually updated when adding new benchmark files.

## Browser Support

Modern browsers with ES6+ support. Tested on:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Development

To run locally:

```bash
cd /path/to/project
python -m http.server 8000
# Open http://localhost:8000 in browser
```

A local HTTP server is required due to CORS restrictions when fetching local files.

## Future Enhancements

Potential additions:
- Game descriptions on each tab
- Export chart images
- Historical performance tracking
- Model-to-model comparison view
- Additional chart types (radar, line)
