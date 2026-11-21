# Game Agent Coding League (GACL)

This repository contains the static dashboard for the [Competitive LLM Agent Benchmark](https://github.com/summersonnn/Game-Agent-Coding-Benchmark). Models generate code for game-playing agents; the benchmark runner schedules matches and writes scoreboards for this dashboard.

## Current benchmark

| ID | Game | Players |
| --- | --- | --- |
| A1 | Battleship | 2 |
| A2 | LieOnce | 2 |
| A3 | Wizard | 6 |
| A4 | Backgammon | 2 |
| A5 | Connect4 (Random Start) | 2 |
| A6 | WordMatrix | 2 |
| A7 | Mancala | 2 |
| A8 | Surround Morris | 2 |

The current model roster is in [docs/data/models.txt](docs/data/models.txt). Each model has two agents per game in the benchmark. Game prompts in `docs/data/full_prompts/` are based on the benchmark's `games/` directory and include the current tournament configuration.

Current tournament scoreboards are not ready; the dashboard intentionally starts empty. Earlier results and the former A7 MiniChess prompt are preserved under `docs/data/archive/legacy/`. Those results describe a different roster and A7 game and should not be mixed into current standings.


## Agent creation

The league's Claude agents are written using the Claude Code VS Code extension, GPT agents using the Codex VS Code extension, and Gemini agents using the Antigravity VS Code extension. Open-source agents are written using DeepSeek Harness (`dsh`) with OpenRouter credentials.

The benchmark repository also supports generating every agent through OpenRouter, although that is not very economical :)

## Run locally

Python 3.12 or newer is required. From the repository root:

```bash
uv sync
uv run python server.py
```

Open http://localhost:8000. The server regenerates `docs/data/leaderboard.json` once at startup. To regenerate it manually after adding scoreboards, run `uv run python utils/process_leaderboards.py`.

## Update results

When current tournament data is ready, copy each runner scoreboard to `docs/data/leaderboards/A1-scoreboard.txt` through `A8-scoreboard.txt`, then regenerate the JSON. Empty or missing files result in empty game leaderboards. The overall view averages the available game scores, so partial results are not a complete league ranking.

The processor selects each model's agent by league points per game, using score per game as a tiebreaker. It normalizes points against the maximum possible, then applies weights in `docs/data/config.json`. Backgammon is excluded from normalized results: the runner awards league points per race, while its scoreboard records games and does not include the number of races. The source scoreboard format must expose race counts before those results can be normalized accurately.

`docs/data/runs.json` is optional metadata displayed as the last run date. Do not reuse the historical manifest for new results. `utils/update_manifest.py` operates on files in `docs/data/runs/` and does not import runner scoreboards.
