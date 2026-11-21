"""Copy benchmark scoreboards and derive Backgammon race counts from match logs.

The log aggregates must match every scoreboard field before anything is copied.
Run: python utils/import_tournament.py /path/to/Competitive-LLM-Agents
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'docs' / 'data'


def backgammon_races(source):
    totals = defaultdict(lambda: [0, 0, 0, 0, 0, 0.0, 0.0])
    logs = sorted((source / 'results' / 'backgammon').glob('*_match.txt'))
    if not logs:
        raise ValueError('No Backgammon match logs found')
    for path in logs:
        with path.open() as stream:
            header = ''.join(stream.readline() for _ in range(9))
            stream.seek(0, 2)
            stream.seek(max(0, stream.tell() - 5000))
            tail = stream.read()
        match = re.search(r'Match Contenders:\n([^\n]+)\n([^\n]+)\n\nResult:\n(.+?) : Pts: ([\d.]+) - Score: ([\d.-]+)\n(.+?) : Pts: ([\d.]+) - Score: ([\d.-]+)', header)
        games = re.search(r'GAMES_PLAYED:(\d+)', tail)
        wins = re.search(r'WINS:Agent-1=(\d+),Agent-2=(\d+)', tail)
        draws = re.search(r'DRAWS:(\d+)', tail)
        if not all((match, games, wins, draws)):
            raise ValueError(f'Incomplete Backgammon log: {path}')
        a, b, name_a, points_a, score_a, name_b, points_b, score_b = match.groups()
        if (a, b) != (name_a, name_b):
            raise ValueError(f'Inconsistent contenders: {path}')
        for name, won, lost, points, score in (
            (a, int(wins[1]), int(wins[2]), float(points_a), float(score_a)),
            (b, int(wins[2]), int(wins[1]), float(points_b), float(score_b)),
        ):
            row = totals[name]
            for i, value in enumerate((1, int(games[1]), won, lost, int(draws[1]), points, score)):
                row[i] += value
    scoreboard = source / 'scoreboard' / 'A4-scoreboard.txt'
    seen = set()
    for line in scoreboard.read_text().splitlines()[1:]:
        row = [part.strip() for part in line.split('|')]
        if len(row) != 7 or row[0] in seen or row[0] not in totals:
            raise ValueError(f'Unexpected Backgammon scoreboard row: {line}')
        seen.add(row[0])
        if totals[row[0]][1:] != [float(value) for value in row[1:]]:
            raise ValueError(f'Logs do not match scoreboard for {row[0]}')
    if seen != set(totals):
        raise ValueError('Backgammon logs and scoreboard contain different agents')
    return {
        'scoreboard_sha256': hashlib.sha256(scoreboard.read_bytes()).hexdigest(),
        'source': 'results/backgammon match logs, validated against all scoreboard totals',
        'races': {name: values[0] for name, values in sorted(totals.items())},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    source = parser.parse_args().source
    races = backgammon_races(source)
    scoreboards = [source / 'scoreboard' / f'A{i}-scoreboard.txt' for i in range(1, 9)]
    for path in scoreboards:
        if not path.is_file() or not path.read_text().strip():
            raise ValueError(f'Missing or empty scoreboard: {path}')
    roster = source / 'config' / 'models.txt'
    if not roster.is_file():
        raise ValueError('Missing benchmark roster')
    prompts = {
        'A1-Battleship.txt': 'battleship.txt',
        'A2-LieOnce.txt': 'lieonce.txt',
        'A3-Wizard.txt': 'wizard.txt',
        'A4-Backgammon.txt': 'backgammon.txt',
        'A5-Connect4RandomStart.txt': 'connect4.txt',
        'A6-WordMatrixGame.txt': 'wordmatrix.txt',
        'A7-Mancala.txt': 'mancala.txt',
        'A8-SurroundMorris.txt': 'surround_morris.txt',
    }
    for name in prompts:
        if not (source / 'games' / name).is_file():
            raise ValueError(f'Missing benchmark prompt: {name}')
    for path in scoreboards:
        shutil.copyfile(path, DATA / 'leaderboards' / path.name)
    shutil.copyfile(roster, DATA / 'models.txt')
    for name, destination in prompts.items():
        shutil.copyfile(source / 'games' / name, DATA / 'full_prompts' / destination)
    (DATA / 'backgammon_races.json').write_text(json.dumps(races, indent=2) + '\n')
    print(f'Copied {len(scoreboards)} scoreboards, prompts and roster; verified {sum(races["races"].values()) // 2} Backgammon races.')


if __name__ == '__main__':
    main()
