import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from utils import process_leaderboards as processor


class BackgammonProcessingTests(unittest.TestCase):
    def test_selection_and_normalization_use_races(self):
        entries = [
            {'agent': 'model:1', 'games': 200, 'races': 10, 'points': 24, 'score': 12},
            {'agent': 'model:2', 'games': 100, 'races': 10, 'points': 18, 'score': 30},
        ]
        best = processor.select_best_agents(entries)
        self.assertEqual(best[0]['agent'], 'model:1')
        self.assertEqual(processor.normalize_points(best, 'A4')[0]['normalized'], 80.0)

    def test_stale_race_counts_are_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / 'docs' / 'data'
            boards = data / 'leaderboards'
            boards.mkdir(parents=True)
            board = boards / 'A4-scoreboard.txt'
            board.write_text('Agent | Games | Wins | Losses | Draws | Points | Score\nmodel:1 | 8 | 5 | 3 | 0 | 6 | 3\n')
            (data / 'config.json').write_text(json.dumps({'games': [{'code': 'A4', 'id': 'game4', 'weight': 9}]}))
            (data / 'backgammon_races.json').write_text(json.dumps({'scoreboard_sha256': hashlib.sha256(board.read_bytes()).hexdigest(), 'races': {'model:1': 2}}))
            output = data / 'leaderboard.json'
            with patch.object(processor, 'BASE_DIR', str(root)), patch.object(processor, 'DATA_DIR', str(boards)), patch.object(processor, 'CONFIG_FILE', str(data / 'config.json')), patch.object(processor, 'OUTPUT_FILE', str(output)), contextlib.redirect_stdout(io.StringIO()):
                processor.main()
                self.assertEqual(json.loads(output.read_text())['games']['game4'][0]['normalized'], 100.0)
                board.write_text(board.read_text().replace(' | 6 |', ' | 3 |'))
                processor.main()
                self.assertEqual(json.loads(output.read_text())['games']['game4'], [])


if __name__ == '__main__':
    unittest.main()
