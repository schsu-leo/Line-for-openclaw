export function detectDisplayMode(rows, queryMode) {
  if (queryMode !== 'llm') return 'table';
  if (!rows.length) return 'table';
  if (rows.length === 1) {
    const values = Object.values(rows[0]).filter((v) => v !== null && v !== undefined);
    const allNumeric = values.length > 0 && values.every((v) => !isNaN(Number(v)));
    if (allNumeric) return 'answer-card';
  }
  if (rows.length < 20) return 'compact';
  return 'large';
}
