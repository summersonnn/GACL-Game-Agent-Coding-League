# Game Agent Coding League - Developer Guide

## Commands

- **Start Server**: `uv run python server.py`
  - Runs the local web server at `http://localhost:8000`.
  - Automatically processes leaderboard data on startup and when `data/leaderboard.json` is requested.
- **Process Leaderboards**: `uv run python utils/process_leaderboards.py`
  - Manually parses `data/leaderboards/*.txt` and generates `data/leaderboard.json`.
- **Lint/Format**: `uv run ruff check .` / `uv run ruff format .`
- **Dependency Management**:
  - Add package: `uv add <package>`
  - Sync environment: `uv sync`

## Architecture

- **Frontend**: Vanilla HTML/JS with Tailwind CSS (via CDN) and Chart.js.
  - `index.html`: Single-page application structure.
  - `js/main.js`: Fetches `data/leaderboard.json` and renders charts.
- **Backend**: Python-based data processing.
  - `server.py`: Simple HTTP server that triggers data processing.
  - `utils/process_leaderboards.py`: Core logic to parse raw game scores and compute weighted rankings.
- **Data Flow**:
  1. Raw scores (`A*-scoreboard.txt`) -> `data/leaderboards/`
  2. Processing script (`process_leaderboards.py`) reads txt files.
  3. JSON output -> `data/leaderboard.json`.
  4. Frontend fetches JSON and displays it.

## Code Style Guidelines

- **Python**:
  - Use `snake_case` for variables and functions.
  - Use `PascalCase` for classes.
  - Use `UPPER_SNAKE_CASE` for constants.
  - Type hinting is mandatory.
  - Max 5 arguments per function.
  - Use `pathlib` or `os.path` for file operations.
  - Error handling: Catch specific exceptions, use logging instead of print where possible (except simple CLI scripts).
- **JavaScript**:
  - Use modern ES6+ syntax.
  - `camelCase` for variables and functions.
- **Formatting**:
  - Python: 88-character line limit (Ruff defaults).
  - Indentation: 4 spaces.

## File Structure

- `data/leaderboards/`: Contains raw score text files (e.g., `A1-scoreboard.txt`).
- `data/leaderboard.json`: Generated JSON file used by the frontend.
- `data/config.json`: Configuration for game weights.
- `utils/`: Helper scripts for data processing.
