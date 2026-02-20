# Game Agent Coding League (GACL)

The **Game Agent Coding League** is a benchmarking platform designed to evaluate Large Language Models (LLMs) on their ability to generate code for game-playing agents. This project provides a web-based dashboard to visualize model performance across multiple strategic games.

## Overview

In this league, LLMs are tasked with implementing game agents for various strategy games (e.g., Battleship, Connect4, Tic-Tac-Toe). These agents then compete in a round-robin tournament. This repository hosts the visualization dashboard that effectively aggregates and displays the results of these tournaments.

**Current Games:**
1. **Battleship** (A1)
2. **Tic-Tac-Toe** (A2)
3. **WordFinder** (A4)
4. **Connect4** (A5)
5. **Surround Morris** (A8)

## Features

- **Automated Leaderboards**: Parses raw tournament match logs to generate up-to-date standings.
- **Weighted Scoring**: Calculates an overall "Meta-Score" based on weighted performance across all games.
- **Interactive Visualization**: Uses Chart.js to display relative performance and rankings.
- **Static-First Design**: Optimized for simple hosting, with Python-based pre-processing steps.

## Requirements

- **OS**: Linux (recommended) or macOS/Windows.
- **Python**: >= 3.12
- **Package Manager**: [uv](https://github.com/astral-sh/uv) (Mandatory)

## Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository_url>
    cd kubis-benchmark-website
    ```

2.  **Install dependencies**:
    Initialize the virtual environment and install required packages using `uv`:
    ```bash
    uv sync
    ```

## Usage

### 1. Running the Local Server

To view the dashboard and automatically process the latest data:

```bash
uv run python server.py
```

- Open your browser to `http://localhost:8000`.
- The server automatically detects requests to the data file and regenerates the leaderboard if needed.

### 2. Updating Leaderboard Data

The system is designed to read raw score files from the `data/leaderboards/` directory.

To add new results:
1.  Obtain the scoreboard text file from the tournament runner (e.g., `A1-scoreboard.txt` for Battleship).
2.  Place the file in `data/leaderboards/`.
3.  Ensure the filename matches the expected pattern: `A1` (Battleship), `A2` (Tic-Tac-Toe), `A4` (WordFinder), `A5` (Connect4), `A8` (Surround Morris).
4.  The server will automatically re-process these files when you refresh the webpage.

Alternatively, you can manually trigger the processing script:

```bash
uv run python utils/process_leaderboards.py
```

### 3. Configuring Game Weights

You can adjust the importance of each game in the overall ranking by editing `data/config.json`.
Update the `"weight"` property for each game object.

## Project Structure

```
.
├── css/                    # Custom stylesheets
├── data/
│   ├── config.json         # General configuration
│   ├── leaderboards/       # RAW INPUT: Text files with match scores
│   ├── leaderboard.json    # GENERATED OUTPUT: JSON data for frontend
│   └── runs/               # Historical run data
├── js/
│   └── main.js             # Frontend logic (Chart.js integration)
├── utils/
│   ├── process_leaderboards.py  # Core script to parse text files -> JSON
│   └── update_manifest.py       # Helper for historical run management
├── server.py               # Local development server
├── index.html              # Main dashboard entry point
├── pyproject.toml          # Python dependency definition
└── CLAUDE.md               # Developer documentation
```

## Licensing

[Add License Information Here]
