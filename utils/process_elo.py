"""Generate static Elo leaderboards and head-to-head results from match logs."""

import argparse
from collections import Counter, defaultdict
from itertools import combinations
import json
from math import exp, log
from pathlib import Path
import re
from tempfile import TemporaryDirectory

from .process_leaderboards import clean_model_name, load_config, parse_leaderboard_file


DATA = Path(__file__).resolve().parents[1] / 'docs' / 'data'
LOG_DIRECTORIES = {
    'A1': 'battleship',
    'A2': 'lie_once',
    'A3': 'wizard',
    'A4': 'backgammon',
    'A5': 'connect4',
    'A6': 'word_matrix',
    'A7': 'mancala',
    'A8': 'surround_morris',
}
ELO_CENTER = 1500
ELO_SCALE = 400 / log(10)
RATING_PRIOR_PRECISION = 0.01
WIZARD_PLACEMENTS = ('1st', '2nd', '3rd', '4th', '5th', '6th')
RACE_RESULTS = {(3, 0): 1, (0, 3): 0, (1, 1): 0.5}
FINAL_RESULTS = re.compile(r'^Final Result: (.+)$', re.MULTILINE)
GAME_NUMBERS = re.compile(r'^Game (\d+)$', re.MULTILINE)
WINNER = re.compile(r'(.+?)(?: \([^)]*\))? wins\b')
TWO_PLAYER_ROW = re.compile(r'(.+) : Pts: (\d+(?:\.\d+)?) - Score: (-?\d+(?:\.\d+)?)')
WIN_COUNTS = re.compile(r'^WINS:Agent-1=(\d+),Agent-2=(\d+)$', re.MULTILINE)
DRAW_COUNT = re.compile(r'^DRAWS:(\d+)$', re.MULTILINE)
WIZARD_RANKINGS = re.compile(r'^Rankings:\n((?: +\d+\. Agent-\d+: score=-?\d+\n)+)', re.MULTILINE)
WIZARD_RANK = re.compile(r' +(\d+)\. Agent-(\d+): score=(-?\d+)')


def read_match(text, players):
    header, separator, body = text.partition('\nResult:\n')
    lines = header.strip().splitlines()
    if not separator or len(lines) != players + 1 or lines[0] != 'Match Contenders:':
        raise ValueError('missing or invalid match header')
    agents = tuple(lines[1:])
    if players == 6:
        prefixes = tuple(f'Agent-{number}: ' for number in range(1, players + 1))
        if not all(agent.startswith(prefix) for agent, prefix in zip(agents, prefixes)):
            raise ValueError('invalid Wizard contender labels')
        agents = tuple(agent.removeprefix(prefix) for agent, prefix in zip(agents, prefixes))
    if len(set(agents)) != players or any(not agent for agent in agents):
        raise ValueError('missing or repeated contenders')
    return agents, body


def read_two_player_games(agents, body):
    summary = [TWO_PLAYER_ROW.fullmatch(line) for line in body.split('\n', 2)[:2]]
    if len(summary) != 2 or not all(summary) or {row[1] for row in summary} != set(agents):
        raise ValueError('missing or invalid match result')
    totals = {row[1]: (float(row[2]), float(row[3])) for row in summary}

    outcomes = []
    agent_index = {**dict(zip(agents, (0, 1))), 'Agent-1': 0, 'Agent-2': 1}
    for result in FINAL_RESULTS.findall(body):
        if re.match(r'Draw\b', result):
            outcomes.append(0.5)
            continue
        winner = WINNER.match(result)
        if not winner or winner[1] not in agent_index:
            raise ValueError(f'unrecognized game result: {result}')
        outcomes.append(1 - agent_index[winner[1]])

    wins = WIN_COUNTS.findall(body)
    draws = DRAW_COUNT.findall(body)
    counts = Counter(outcomes)
    if wins != [(str(counts[1]), str(counts[0]))] or draws != [str(counts[0.5])]:
        raise ValueError('individual game results disagree with the match summary')
    return outcomes, counts, totals


def read_wizard_games(body):
    for rankings in WIZARD_RANKINGS.findall(body):
        rows = [WIZARD_RANK.fullmatch(line) for line in rankings.splitlines()]
        if (not all(rows) or [int(row[1]) for row in rows] != list(range(1, 7))
                or {int(row[2]) for row in rows} != set(range(1, 7))):
            raise ValueError('invalid Wizard rankings')
        # Seats rotate between games. The Agent-N labels always refer to the header.
        yield tuple(int(row[3]) for row in sorted(rows, key=lambda row: int(row[2])))


def record_pair_result(results, a, b, outcome, count=1):
    results[a][b][outcome] += count
    results[b][a][1 - outcome] += count


def record_wizard_game(pair_results, agents, scores):
    for (a, score_a), (b, score_b) in combinations(zip(agents, scores), 2):
        actual = 0.5 if score_a == score_b else float(score_a > score_b)
        record_pair_result(pair_results, a, b, actual)


def solve_positive_definite(matrix, rhs):
    """Solve a positive definite system using in-place Gaussian elimination."""
    size = len(rhs)
    for pivot in range(size):
        for row in range(pivot + 1, size):
            factor = matrix[row][pivot] / matrix[pivot][pivot]
            for col in range(pivot + 1, size):
                matrix[row][col] -= factor * matrix[pivot][col]
            rhs[row] -= factor * rhs[pivot]

    solution = [0.0] * size
    for row in reversed(range(size)):
        known = sum(matrix[row][col] * solution[col] for col in range(row + 1, size))
        solution[row] = (rhs[row] - known) / matrix[row][row]
    return solution


def fit_ratings(agents, pair_results):
    """Fit Elo to aggregate results with a weak prior centered on 1500."""
    agents = sorted(agents)
    index = {agent: i for i, agent in enumerate(agents)}
    pairs = [
        (index[a], index[b], counts.total(), counts[1] + counts[0.5] / 2)
        for a in agents
        for b, counts in sorted(pair_results.get(a, {}).items())
        if a < b
    ]

    # Work in log-odds units and convert to Elo after the fit.
    strengths = [0.0] * len(agents)
    for _ in range(100):
        gradient = [-RATING_PRIOR_PRECISION * value for value in strengths]
        information = [[0.0] * len(agents) for _ in agents]
        for i in range(len(agents)):
            information[i][i] = RATING_PRIOR_PRECISION

        for a, b, games, actual in pairs:
            difference = strengths[a] - strengths[b]
            odds = exp(-abs(difference))
            expected = (1 if difference >= 0 else odds) / (1 + odds)
            residual = actual - games * expected
            gradient[a] += residual
            gradient[b] -= residual
            curvature = games * odds / (1 + odds) ** 2
            information[a][a] += curvature
            information[b][b] += curvature
            information[a][b] -= curvature
            information[b][a] -= curvature

        step = solve_positive_definite(information, gradient)
        largest_step = max(map(abs, step))
        if largest_step < 1e-9:
            return {agent: ELO_CENTER + ELO_SCALE * value for agent, value in zip(agents, strengths)}
        # Limit the change in any pair's log odds to one per Newton step.
        scale = min(1.0, 0.5 / largest_step)
        strengths = [value + scale * delta for value, delta in zip(strengths, step)]

    raise ValueError('Tournament Elo fit did not converge')


def collect_wizard_totals(agents, games, totals):
    match_totals = {agent: Counter() for agent in agents}
    for scores in games:
        for agent, score in zip(agents, scores):
            start = sum(other > score for other in scores)
            tied = scores.count(score)
            row = match_totals[agent]
            row.update(games=1, score=score, points=5 - start - (tied - 1) / 2)
            for place in WIZARD_PLACEMENTS[start:start + tied]:
                row[place] += 1 / tied
    for agent, row in match_totals.items():
        # The runner formats placements to one decimal, then rounds each match.
        totals[agent].update({field: round(round(value, 1)) for field, value in row.items()})


def summarize_head_to_head(pair_results):
    model_results = defaultdict(lambda: defaultdict(Counter))
    for agent, opponents in pair_results.items():
        model = clean_model_name(agent)
        for opponent, counts in opponents.items():
            opponent_model = clean_model_name(opponent)
            if model != opponent_model:
                model_results[model][opponent_model].update(counts)

    return {
        model: {
            opponent: {
                'wins': counts[1],
                'draws': counts[0.5],
                'losses': counts[0],
                'score_pct': round(100 * (counts[1] + counts[0.5] / 2) / counts.total(), 1),
            }
            for opponent, counts in sorted(opponents.items())
        }
        for model, opponents in sorted(model_results.items())
    }


def rate_game(directory, scoreboard, code):
    entries = parse_leaderboard_file(scoreboard)
    roster = {entry['agent'] for entry in entries}
    if not roster or len(roster) != len(entries):
        raise ValueError(f'Missing or duplicate agents in {scoreboard}')

    wizard = code == 'A3'
    backgammon = code == 'A4'
    fields = ('games', *WIZARD_PLACEMENTS, 'points', 'score') if wizard else (
        'games', 'wins', 'losses', 'draws', 'points', 'score'
    )
    totals = defaultdict(Counter)
    rated = Counter()
    pair_results = defaultdict(lambda: defaultdict(Counter))
    match_count = event_count = qualifier_count = 0

    for path in directory.glob('*.txt'):
        try:
            agents, body = read_match(path.read_text(encoding='utf-8'), 6 if wizard else 2)
            if wizard and len({clean_model_name(agent) for agent in agents}) < len(agents):
                qualifier_count += 1
                continue
            if not all(agent in roster for agent in agents):
                raise ValueError('contender is missing from the tournament scoreboard')

            if wizard:
                outcomes = list(read_wizard_games(body))
                collect_wizard_totals(agents, outcomes, totals)
            else:
                outcomes, counts, summary = read_two_player_games(agents, body)
                for index, agent in enumerate(agents):
                    points, score = summary[agent]
                    totals[agent].update(games=len(outcomes), wins=counts[1 - index],
                                         losses=counts[index], draws=counts[0.5], points=points, score=score)

            game_numbers = [int(number) for number in GAME_NUMBERS.findall(body)]
            if not outcomes or game_numbers != list(range(1, len(outcomes) + 1)):
                raise ValueError('missing, repeated, or out-of-order games')

            if backgammon:
                a, b = agents
                race_points = (summary[a][0], summary[b][0])
                if race_points not in RACE_RESULTS:
                    raise ValueError(f'invalid Backgammon race points: {race_points}')
                outcomes = [RACE_RESULTS[race_points]]
                counts = Counter(outcomes)

            if wizard:
                for scores in outcomes:
                    record_wizard_game(pair_results, agents, scores)
            else:
                a, b = agents
                for outcome, count in counts.items():
                    record_pair_result(pair_results, a, b, outcome, count)

            rated.update({agent: len(outcomes) for agent in agents})
            match_count += 1
            event_count += len(outcomes)
        except (OSError, ValueError) as error:
            raise ValueError(f'{path.name}: {error}') from error

    if not match_count:
        raise ValueError(f'No tournament matches in {directory}')
    for entry in entries:
        agent = entry['agent']
        for field in fields:
            actual = round(totals[agent][field], 1)
            if actual != entry[field]:
                raise ValueError(f'{scoreboard.name}: {agent} {field} is {actual} in logs, '
                                 f'expected {entry[field]}')

    print(f'{code} {directory.name}: {match_count} matches, {event_count} rated '
          f'{"races" if backgammon else "games"}'
          + (f', {qualifier_count} qualifier tables excluded' if wizard else ''))
    return fit_ratings(roster, pair_results), rated, {
        'matches': match_count,
        'rated_events': event_count,
        'qualifiers_excluded': qualifier_count,
        'unit': 'races' if backgammon else 'games',
        'head_to_head': summarize_head_to_head(pair_results),
    }


def summarize_agents(ratings, rated):
    agents_by_model = defaultdict(list)
    for agent in ratings:
        if rated[agent]:
            agents_by_model[clean_model_name(agent)].append(agent)

    maximums, averages = [], []
    for model, agents in agents_by_model.items():
        best = min(agents, key=lambda agent: (-ratings[agent], agent))
        maximums.append({'model': model, 'agent': best, 'elo': ratings[best], 'rated': rated[best]})
        averages.append({
            'model': model,
            'elo': sum(ratings[agent] for agent in agents) / len(agents),
            'rated': sum(rated[agent] for agent in agents),
        })
    return {'max': maximums, 'mean': averages}


def overall_standings(model_game_ratings, weights):
    weighted, unweighted = [], []
    for model, ratings in model_game_ratings.items():
        weighted_sum = sum(rating * weights[game_id] for game_id, rating in ratings.items())
        total_weight = sum(weights[game_id] for game_id in ratings)
        weighted.append({'model': model, 'elo': round(weighted_sum / total_weight, 2)})
        unweighted.append({'model': model, 'elo': round(sum(ratings.values()) / len(ratings), 2)})
    for standings in (weighted, unweighted):
        standings.sort(key=lambda row: (-row['elo'], row['model']))
    return weighted, unweighted


def build_leaderboard(results_dir, scoreboard_dir):
    game_ids, weights = load_config()
    games = {}
    model_game_ratings = {'max': defaultdict(dict), 'mean': defaultdict(dict)}
    for code, game_id in game_ids.items():
        ratings, rated, info = rate_game(results_dir / LOG_DIRECTORIES[code],
                                         scoreboard_dir / f'{code}-scoreboard.txt', code)
        models = summarize_agents(ratings, rated)
        for mode, standings in models.items():
            standings.sort(key=lambda row: (-row['elo'], row['model']))
            for row in standings:
                model_game_ratings[mode][row['model']][game_id] = row['elo']
                row['elo'] = round(row['elo'], 2)

        games[game_id] = {
            **info,
            'agents': [
                {'agent': agent, 'elo': round(ratings[agent], 2), 'rated': rated[agent]}
                for agent in sorted(ratings, key=lambda agent: (-ratings[agent], agent))
            ],
            'models': models,
        }

    overall, overall_unweighted = overall_standings(model_game_ratings['max'], weights)
    overall_mean, overall_mean_unweighted = overall_standings(model_game_ratings['mean'], weights)
    return {
        'rating_method': 'batch_elo',
        'rating_center': ELO_CENTER,
        'games': games,
        'overall': overall,
        'overall_unweighted': overall_unweighted,
        'overall_mean': overall_mean,
        'overall_mean_unweighted': overall_mean_unweighted,
    }


def generate_leaderboard(results_dir=DATA / 'results', output_path=DATA / 'elo.json'):
    data = build_leaderboard(results_dir, DATA / 'leaderboards')
    # Leave the existing export available if parsing or writing fails.
    with TemporaryDirectory(dir=output_path.parent) as directory:
        output = Path(directory) / output_path.name
        output.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
        output.replace(output_path)
    print(f'Wrote {output_path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--results-dir', type=Path, default=DATA / 'results')
    parser.add_argument('--output', type=Path, default=DATA / 'elo.json')
    args = parser.parse_args()
    try:
        generate_leaderboard(args.results_dir, args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
