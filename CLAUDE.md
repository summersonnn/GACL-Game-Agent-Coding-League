# Game Agent Coding League - Developer Guide

This repository serves the static dashboard from `docs/`. The benchmark runner and authoritative model roster and game prompts are maintained in the sibling Competitive-LLM-Agents repository.

- Run `uv run python server.py` to regenerate the leaderboard once and serve `docs/` at http://localhost:8000.
- Run `uv run python utils/process_leaderboards.py` after changing scoreboards or weights.
- Raw current inputs are `docs/data/leaderboards/A*-scoreboard.txt`; generated output is `docs/data/leaderboard.json`.
- Game names and weights live in `docs/data/config.json`, the roster in `docs/data/models.txt`, and game prompts in `docs/data/full_prompts/`.
- Historical scoreboards and generated data are in `docs/data/archive/legacy/`. Do not mix them into current results: the roster and A7 game changed.
- Backgammon league points are awarded per race; the current raw scoreboard has game counts but no race counts. Do not calculate its normalized points using game counts.
- The frontend uses vanilla JavaScript, Tailwind CSS and Chart.js. Keep the static site usable without a backend beyond file serving.
