from collections import Counter, defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from utils import process_elo as elo


class EloTests(unittest.TestCase):
    def test_max_and_mean_ratings_are_independent_of_match_order(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            board = directory / 'A1-scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\n'
                             'a:1 | 2 | 2 | 0 | 0 | 6 | 2.0\n'
                             'a:2 | 1 | 0 | 1 | 0 | 0 | -1.0\n'
                             'b:1 | 2 | 1 | 1 | 0 | 3 | 0.0\n'
                             'b:2 | 1 | 0 | 1 | 0 | 0 | -1.0\n')
            logs = directory / 'battleship'
            logs.mkdir()
            matches = (('a:1', 'b:1'), ('b:1', 'a:2'), ('a:1', 'b:2'))
            for index, (winner, loser) in enumerate(matches):
                (logs / f'20261121_111111_{index:06d}_match_agents_match.txt').write_text(f'''Match Contenders:
{winner}
{loser}

Result:
{winner} : Pts: 3 - Score: 1.0
{loser} : Pts: 0 - Score: -1.0

Game 1
Final Result: {winner} wins
Scores:
Agent-1: 1
Agent-2: -1
WINS:Agent-1=1,Agent-2=0
DRAWS:0
''')

            ratings, rated, info = elo.rate_game(logs, board, 'A1')
            self.assertEqual(rated, {'a:1': 2, 'a:2': 1, 'b:1': 2, 'b:2': 1})
            self.assertEqual(info['matches'], 3)
            self.assertEqual(info['rated_events'], 3)
            self.assertEqual(info['head_to_head'], {
                'a': {'b': {'wins': 2, 'draws': 0, 'losses': 1, 'score_pct': 66.7}},
                'b': {'a': {'wins': 1, 'draws': 0, 'losses': 2, 'score_pct': 33.3}},
            })

            maximums, averages = elo.summarize_agents(ratings, rated).values()
            best_a = next(row for row in maximums if row['model'] == 'a')
            mean_a = next(row for row in averages if row['model'] == 'a')
            self.assertEqual(best_a['agent'], 'a:1')
            self.assertGreater(best_a['elo'], elo.ELO_CENTER)
            self.assertLess(ratings['a:2'], 1500)
            self.assertAlmostEqual(mean_a['elo'], (ratings['a:1'] + ratings['a:2']) / 2)
            self.assertEqual(mean_a['rated'], 3)

            reordered = directory / 'reordered'
            reordered.mkdir()
            paths = sorted(logs.iterdir())
            for target, source in zip(paths, reversed(paths)):
                (reordered / target.name).write_bytes(source.read_bytes())
            self.assertEqual(elo.rate_game(reordered, board, 'A1'), (ratings, rated, info))

    def test_weighted_margins_across_matches_and_unweighted_draws(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            board = directory / 'scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\n'
                             'a:1 | 5 | 3 | 1 | 1 | 10 | -3.0\n'
                             'b:1 | 5 | 1 | 3 | 1 | 4 | 3.0\n')
            logs = directory / 'results'
            logs.mkdir()
            (logs / 'first_match.txt').write_text('''Match Contenders:
a:1
b:1

Result:
a:1 : Pts: 6 - Score: 6.0
b:1 : Pts: 0 - Score: -6.0

Game 1
Final Result: a:1 wins
Scores:
Agent-1: 3
Agent-2: -3

Game 2
Final Result: a:1 wins
Scores:
Agent-1: 3
Agent-2: -3
WINS:Agent-1=2,Agent-2=0
DRAWS:0
''')
            (logs / 'second_match.txt').write_text('''Match Contenders:
b:1
a:1

Result:
b:1 : Pts: 4 - Score: 9.0
a:1 : Pts: 4 - Score: -9.0

Game 1
Final Result: Agent-2 wins
Scores:
Agent-1: -3
Agent-2: 3

Game 2
Final Result: Agent-1 wins
Scores:
Agent-1: 12
Agent-2: -12

Game 3
Final Result: Draw
Scores:
Agent-1: 0
Agent-2: 0
WINS:Agent-1=1,Agent-2=1
DRAWS:1
''')
            expected = elo.fit_ratings(
                ('a:1', 'b:1'), {'a:1': {'b:1': Counter({1: 9 / 5.25, 0.5: 1, 0: 12 / 5.25})}}
            )
            for code in ('A1', 'A5', 'A6', 'A7'):
                with self.subTest(code=code):
                    ratings, rated, info = elo.rate_game(logs, board, code)
                    self.assertEqual(info['mean_winning_score'], 5.25)
                    self.assertEqual(rated, {'a:1': 5, 'b:1': 5})
                    self.assertEqual(info['head_to_head']['a']['b'],
                                     {'wins': 3, 'draws': 1, 'losses': 1, 'score_pct': 70.0})
                    self.assertEqual(ratings, expected)
                    self.assertLess(ratings['a:1'], ratings['b:1'])

    def test_lie_once_weights_wins_with_scores_logged_in_winner_first_order(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            board = directory / 'A2-scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\n'
                             'a:1 | 3 | 1 | 1 | 1 | 4 | -4.0\n'
                             'b:1 | 3 | 1 | 1 | 1 | 4 | 4.0\n')
            logs = directory / 'lie_once'
            logs.mkdir()
            (logs / 'match.txt').write_text('''Match Contenders:
a:1
b:1

Result:
a:1 : Pts: 4 - Score: -4.0
b:1 : Pts: 4 - Score: 4.0

Game 1
Final Result: Agent-1 wins (correct_guess)
Scores:
Agent-1: 90
Agent-2: -90

Game 2
Final Result: Agent-2 wins (tie_attempt_failed)
Scores:
Agent-2: 94
Agent-1: -94

Game 3
Final Result: Draw (tie_attempt_success)
Scores:
Agent-1: 0
Agent-2: 0
WINS:Agent-1=1,Agent-2=1
DRAWS:1
''')

            ratings, rated, info = elo.rate_game(logs, board, 'A2')
            self.assertEqual(info['mean_winning_score'], 92)
            self.assertEqual(rated, {'a:1': 3, 'b:1': 3})
            self.assertEqual(info['head_to_head']['a']['b'],
                             {'wins': 1, 'draws': 1, 'losses': 1, 'score_pct': 50.0})
            expected = elo.fit_ratings(
                ('a:1', 'b:1'), {'a:1': {'b:1': Counter({1: 90 / 92, 0.5: 1, 0: 94 / 92})}}
            )
            self.assertEqual(ratings, expected)

    def test_surround_morris_weights_elimination_and_mate_scores(self):
        with TemporaryDirectory() as temporary:
            logs = Path(temporary) / 'surround_morris'
            logs.mkdir()
            board = logs.parent / 'A8-scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\n'
                             'a:1 | 2 | 1 | 1 | 0 | 3 | -4.0\n'
                             'b:1 | 2 | 1 | 1 | 0 | 3 | 4.0\n')
            (logs / 'match.txt').write_text('''Match Contenders:
a:1
b:1

Result:
a:1 : Pts: 3 - Score: -4.0
b:1 : Pts: 3 - Score: 4.0

Game 1
Final Result: Agent-1 wins (Agent-2 has 0 pieces)
Scores:
Agent-1: 3
Agent-2: -3

Game 2
Final Result: Agent-2 wins by Mate (Agent-1 has no legal moves)
Scores:
Agent-1: -7
Agent-2: 7
WINS:Agent-1=1,Agent-2=1
DRAWS:0
''')

            ratings, _, info = elo.rate_game(logs, board, 'A8')
            self.assertEqual(info['mean_winning_score'], 5)
            self.assertEqual(info['head_to_head']['a']['b'],
                             {'wins': 1, 'draws': 0, 'losses': 1, 'score_pct': 50.0})
            expected = elo.fit_ratings(
                ('a:1', 'b:1'), {'a:1': {'b:1': Counter({1: 3 / 5, 0: 7 / 5})}}
            )
            self.assertEqual(ratings, expected)

    def test_wizard_weights_head_to_head_score_gaps_and_keeps_full_weight_draws(self):
        rankings = '''Rankings:
  1. Agent-3: score=50
  2. Agent-2: score=50
  3. Agent-1: score=40
  4. Agent-6: score=30
  5. Agent-4: score=20
  6. Agent-5: score=-10
'''
        scores, = elo.read_wizard_games(rankings)
        self.assertEqual(scores, (40, 50, 50, 20, -10, 30))
        agents = tuple(f'{model}:1' for model in 'abcdef')
        pair_results = defaultdict(lambda: defaultdict(Counter))
        margin_totals = defaultdict(lambda: defaultdict(Counter))
        elo.record_wizard_game(pair_results, margin_totals, agents, scores)
        elo.record_wizard_game(pair_results, margin_totals, agents, (70, 30, 30, 20, 0, 60))

        weighted, mean = elo.weight_results_by_score(pair_results, margin_totals)
        self.assertEqual(mean, (400 + 470) / (14 + 14))
        self.assertEqual(weighted['a:1']['b:1'], Counter({1: 40 / mean, 0: 10 / mean}))
        self.assertEqual(weighted['b:1']['a:1'], Counter({1: 10 / mean, 0: 40 / mean}))
        self.assertEqual(weighted['b:1']['c:1'], Counter({0.5: 2}))

        ratings = elo.fit_ratings(agents, weighted)
        self.assertAlmostEqual(ratings['b:1'], ratings['c:1'])
        self.assertGreater(ratings['a:1'], ratings['b:1'])
        self.assertLess(ratings['e:1'], ratings['f:1'])
        self.assertAlmostEqual(sum(ratings.values()), 6 * elo.ELO_CENTER)
        matrix = elo.summarize_head_to_head(pair_results)
        self.assertEqual(matrix['b']['c'], {'wins': 0, 'draws': 2, 'losses': 0, 'score_pct': 50.0})
        self.assertEqual(matrix['b']['a'], {'wins': 1, 'draws': 0, 'losses': 1, 'score_pct': 50.0})
        self.assertEqual(len(matrix['b']), 5)

    def test_backgammon_weights_races_by_final_margin(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            board = directory / 'A4-scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\n'
                             'a:1 | 14 | 8 | 6 | 0 | 4 | 2.0\n'
                             'b:1 | 14 | 6 | 8 | 0 | 4 | -2.0\n')
            logs = directory / 'backgammon'
            logs.mkdir()
            races = (
                ((3, 0), (5, 2), (1, 2, 1, 2, 1)),
                ((0, 3), (4, 5), (1, 2, 1, 2, 1, 1, 2)),
                ((1, 1), (1, 1), (1, 2)),
            )
            for number, (league_points, race_scores, winners) in enumerate(races, start=1):
                points_a, points_b = league_points
                score_a, score_b = race_scores
                games = ''.join(f'Game {index}\nFinal Result: Agent-{winner} wins\n'
                                for index, winner in enumerate(winners, start=1))
                (logs / f'race_{number}.txt').write_text(f'''Match Contenders:
a:1
b:1

Result:
a:1 : Pts: {points_a} - Score: {score_a - score_b}.0
b:1 : Pts: {points_b} - Score: {score_b - score_a}.0

{games}WINS:Agent-1={winners.count(1)},Agent-2={winners.count(2)}
DRAWS:0
''')
            ratings, rated, info = elo.rate_game(logs, board, 'A4')
            expected = elo.fit_ratings(
                ('a:1', 'b:1'), {'a:1': {'b:1': Counter({1: 1.5, 0.5: 1, 0: 0.5})}}
            )
            self.assertEqual(ratings, expected)
            self.assertEqual(rated, {'a:1': 3, 'b:1': 3})
            self.assertEqual(info['unit'], 'races')
            self.assertEqual(info['rated_events'], 3)
            self.assertEqual(info['mean_winning_score'], 2)
            self.assertEqual(info['head_to_head']['a']['b'],
                             {'wins': 1, 'draws': 1, 'losses': 1, 'score_pct': 50.0})
