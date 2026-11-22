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

The current model roster is in [docs/data/models.txt](docs/data/models.txt). Each model has two agents per game in the benchmark. Game prompts in `docs/data/full_prompts/` are copied from the benchmark's `games/` directory. The Games page distinguishes the completed tournament settings from runner defaults.

The dashboard contains the tournament completed on 21 November 2026. Earlier results and the former A7 MiniChess prompt are preserved under `docs/data/archive/legacy/`. Those results describe a different roster and A7 game and should not be mixed into current standings.


## Agent creation

The league's Claude agents are written using the Claude Code VS Code extension, GPT agents using the Codex VS Code extension, and Gemini agents using the Antigravity VS Code extension. Open-source agents are written using DeepSeek Harness (`dsh`) with OpenRouter credentials.

The benchmark repository also supports generating every agent through OpenRouter, although that is not very economical :)

## Run locally

Python 3.12 or newer is required. From the repository root:

```bash
uv sync
uv run python server.py
```

Open http://localhost:8000. The server regenerates `docs/data/elo.json` from `docs/data/results/` once at startup and can serve the saved ratings and head-to-head results if the logs are unavailable. To regenerate both manually, run `uv run python -m utils.process_elo`.

## Update results

To import a new tournament from the benchmark checkout and regenerate the dashboard:

```bash
python utils/import_tournament.py /path/to/Competitive-LLM-Agents
python -m utils.process_elo --results-dir /path/to/Competitive-LLM-Agents/results
```

The importer copies all eight scoreboards, the model roster, and the game prompts. It also reads the Backgammon match logs, verifies that their game counts, wins, losses, draws, points, and scores match the scoreboard for every agent, and records the number of races. Update `docs/data/runs.json` with the tournament date after verifying the new run. Earlier results remain separate under `docs/data/archive/legacy/`.

Use the same tournament's logs in `docs/data/results/` to regenerate the ratings on server startup. The Elo generator checks log totals against the scoreboards before replacing the saved ratings.

The configured Overall Elo weights range from 1 to 8. The league assigned them by ranking each game's Max Elo spread across the 12 models before introducing score weighting.

For the completed tournament, each of the 24 agents played 176 races or matches per two-player game. Each match contained 20 Battleship, 50 LieOnce, 2 Connect4, 10 WordMatrix, 2 Mancala, or 2 Surround Morris games. Backgammon matches were races to five in-game points, capped at 30 games. Wizard had four qualifier tables of 200 games and 924 main-event tables of six games; each selected agent played 2,772 main-event games. The qualifier count of 200 is not divisible by six, so seats were not distributed equally. These run settings differ from some current runner defaults.

### Elo ratings

The Elo generator fits ratings to all tournament results for each game at once. It uses each agent's wins, losses, and draws against each opponent, so match order has no effect on the ratings. Draws score half a win. A weak prior centered at 1500 keeps ratings finite for agents with only wins or only losses.

Battleship, LieOnce, Connect4, WordMatrix, Mancala, and Surround Morris weight each win and corresponding loss by the winner's score divided by the mean winning score across all decisive games of that title in the tournament. In Battleship, the score counts the winner's remaining ship segments. In LieOnce, the logged score rewards wins with fewer guesses. In Connect4, the logged score rewards faster wins by counting the empty cells at the end of the game, with a minimum score of 3 for a win. In WordMatrix, the winning score is the difference between the winner's and loser's points. In Mancala, the winning score is the difference in stones between the two stores after the final sweep. A forfeit awards a score of 48 to the winner. In Surround Morris, an elimination win scores the winner's remaining pieces, and a mate scores 7. Draws have weight 1 and are excluded from the mean.

Backgammon rates one outcome per race. Each decisive race is weighted by the difference between the final race scores divided by the mean winning margin across all decisive races in the tournament. A 5–2 race therefore carries 1.5 times the weight of a 5–3 race. Drawn races have weight 1 and are excluded from the mean.

Wizard rates 15 head-to-head results per six-player main-event game using the players' final in-game scores. Each win and corresponding loss is weighted by the gap between the two scores divided by the mean gap across all decisive head-to-head results in the main event. Equal scores count as draws with weight 1 and are excluded from the mean. Placement points are used for the points leaderboard only.

Max Elo uses the highest-rated agent for each model in each game. Mean Elo averages the model's rated agents in that game. Both views use the same Wizard rating because one agent per model advances to the main event. The Overall tab defaults to Max Elo and the game weights in `docs/data/config.json`. Either agent view can be combined with equal weights.

Each game tab shows a head-to-head score matrix beneath its leaderboard. Each cell counts wins, draws, and losses for the row model against the column model across their agents. The score percentage gives half credit for draws. Backgammon counts races, and Wizard compares pairs of final scores within each main-event game.
