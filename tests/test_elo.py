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

    def test_wizard_uses_agent_labels_and_draws_for_tied_scores(self):
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
        elo.record_wizard_game(pair_results, agents, scores)
        ratings = elo.fit_ratings(agents, pair_results)
        self.assertAlmostEqual(ratings['b:1'], ratings['c:1'])
        self.assertGreater(ratings['b:1'], ratings['a:1'])
        self.assertLess(ratings['e:1'], ratings['f:1'])
        self.assertAlmostEqual(sum(ratings.values()), 6 * elo.ELO_CENTER)
        matrix = elo.summarize_head_to_head(pair_results)
        self.assertEqual(matrix['b']['c'], {'wins': 0, 'draws': 1, 'losses': 0, 'score_pct': 50.0})
        self.assertEqual(matrix['b']['a'], {'wins': 1, 'draws': 0, 'losses': 0, 'score_pct': 100.0})
        self.assertEqual(len(matrix['b']), 5)

    def test_backgammon_rates_the_race_winner(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            board = directory / 'A4-scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\n'
                             'a:1 | 3 | 2 | 1 | 0 | 0 | -1.0\n'
                             'b:1 | 3 | 1 | 2 | 0 | 3 | 1.0\n')
            logs = directory / 'backgammon'
            logs.mkdir()
            (logs / '20261121_111111_111111_a_vs_b_match.txt').write_text('''Match Contenders:
a:1
b:1

Result:
a:1 : Pts: 0 - Score: -1.0
b:1 : Pts: 3 - Score: 1.0

Game 1
Final Result: Agent-1 (W) wins
Game 2
Final Result: Agent-1 (B) wins
Game 3
Final Result: Agent-2 (B) wins
WINS:Agent-1=2,Agent-2=1
DRAWS:0
''')
            ratings, rated, info = elo.rate_game(logs, board, 'A4')
            self.assertLess(ratings['a:1'], elo.ELO_CENTER)
            self.assertGreater(ratings['b:1'], elo.ELO_CENTER)
            self.assertEqual(rated, {'a:1': 1, 'b:1': 1})
            self.assertEqual(info['rated_events'], 1)
            self.assertEqual(info['head_to_head']['a']['b'],
                             {'wins': 0, 'draws': 0, 'losses': 1, 'score_pct': 0.0})
