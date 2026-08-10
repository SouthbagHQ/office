import { describe, expect, it } from 'vitest';
import { cellName, evaluateCell, expandRange } from './sheet';

describe('spreadsheet engine', () => {
  it('names columns after Z', () => {
    expect(cellName(27, 3)).toBe('AA3');
  });

  it('expands rectangular ranges', () => {
    expect(expandRange('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('evaluates references, arithmetic, and SUM', () => {
    const cells = { A1: '3', A2: '4', B1: '=A1*A2', B2: '=SUM(A1:B1)' };
    expect(evaluateCell('B1', cells)).toBe('12');
    expect(evaluateCell('B2', cells)).toBe('15');
  });

  it('reports circular references', () => {
    expect(evaluateCell('A1', { A1: '=B1', B1: '=A1' })).toBe('#CIRCLE!');
  });
});
