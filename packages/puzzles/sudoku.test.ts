import { describe, it, expect } from 'vitest';
import { countSudokuSolutions, generateSudoku, isValidSudokuSolution, SUDOKU_DIFFICULTIES } from './sudoku';

describe('generateSudoku', () => {
  it('produces the same puzzle for the same seed', () => {
    expect(generateSudoku('seed-1', 'easy')).toEqual(generateSudoku('seed-1', 'easy'));
    expect(generateSudoku('seed-1').puzzle).not.toEqual(generateSudoku('seed-2').puzzle);
  });

  it.each(SUDOKU_DIFFICULTIES)('makes a valid %s puzzle with exactly one solution', (difficulty) => {
    for (const seed of ['a', 'b', 'c']) {
      const { puzzle, solution, clues } = generateSudoku(seed, difficulty);
      expect(isValidSudokuSolution(solution)).toBe(true);
      expect(countSudokuSolutions(puzzle)).toBe(1);
      // Every clue matches the solution
      puzzle.forEach((row, r) => row.forEach((v, c) => v && expect(v).toBe(solution[r][c])));
      expect(puzzle.flat().filter(Boolean)).toHaveLength(clues);
    }
  });

  it('leaves fewer clues on harder puzzles', () => {
    const clues = SUDOKU_DIFFICULTIES.map((d) => generateSudoku('same', d).clues);
    expect(clues[0]).toBe(40);
    expect(clues[1]).toBe(32);
    expect(clues[2]).toBeLessThanOrEqual(30);
  });

  it('rejects broken solutions', () => {
    const { solution } = generateSudoku('x');
    const broken = solution.map((row) => [...row]);
    [broken[0][0], broken[0][1]] = [broken[0][1], broken[0][0]];
    expect(isValidSudokuSolution(broken)).toBe(false);
  });
});
