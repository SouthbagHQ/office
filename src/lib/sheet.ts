function columnNumber(name: string): number {
  return name.split('').reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

export function cellName(column: number, row: number): string {
  let name = '';
  let current = column;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return `${name}${row}`;
}

export function expandRange(start: string, end: string): string[] {
  const matchStart = /^([A-Z]+)(\d+)$/.exec(start);
  const matchEnd = /^([A-Z]+)(\d+)$/.exec(end);
  if (!matchStart || !matchEnd) return [];
  const startColumn = columnNumber(matchStart[1]);
  const endColumn = columnNumber(matchEnd[1]);
  const startRow = Number(matchStart[2]);
  const endRow = Number(matchEnd[2]);
  const cells: string[] = [];
  for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row += 1) {
    for (let column = Math.min(startColumn, endColumn); column <= Math.max(startColumn, endColumn); column += 1) {
      cells.push(cellName(column, row));
    }
  }
  return cells;
}

export function evaluateCell(name: string, cells: Record<string, string>, trail: string[] = []): string {
  const raw = cells[name] ?? '';
  if (!raw.startsWith('=')) return raw;
  if (trail.includes(name)) return '#CIRCLE!';
  const nextTrail = [...trail, name];

  try {
    let expression = raw.slice(1).toUpperCase();
    let evaluationError: string | null = null;
    expression = expression.replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_match, start, end) => {
      const total = expandRange(start, end).reduce((sum, reference) => {
        const evaluated = evaluateCell(reference, cells, nextTrail);
        if (evaluated.startsWith('#')) evaluationError = evaluated;
        const value = Number(evaluated);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      return String(total);
    });
    expression = expression.replace(/\b([A-Z]+\d+)\b/g, (_match, reference) => {
      const evaluated = evaluateCell(reference, cells, nextTrail);
      if (evaluated.startsWith('#')) evaluationError = evaluated;
      const value = Number(evaluated);
      return Number.isFinite(value) ? String(value) : '0';
    });
    if (evaluationError) return evaluationError;
    if (!/^[\d+\-*/().\s]+$/.test(expression)) return '#WORDS?';
    const result = Function(`"use strict"; return (${expression})`)() as number;
    return Number.isFinite(result) ? String(Math.round(result * 10000) / 10000) : '#MATH!';
  } catch {
    return '#NOPE!';
  }
}
