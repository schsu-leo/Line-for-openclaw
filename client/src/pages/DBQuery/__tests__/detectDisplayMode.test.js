import { describe, it, expect } from 'vitest';
import { detectDisplayMode } from '../displayUtils.js';

describe('detectDisplayMode', () => {
  // Visual query always shows table regardless of row count
  it('returns "table" for visual query mode with any rows', () => {
    const rows = [{ total: 1000 }];
    expect(detectDisplayMode(rows, 'visual')).toBe('table');
  });

  // LLM with no rows
  it('returns "table" for LLM query with empty rows', () => {
    expect(detectDisplayMode([], 'llm')).toBe('table');
  });

  // LLM with 1 row, all numeric values → answer card
  it('returns "answer-card" for LLM query with 1 row of all-numeric values', () => {
    const rows = [{ 本月出貨總金額: '1234567.00' }];
    expect(detectDisplayMode(rows, 'llm')).toBe('answer-card');
  });

  it('returns "answer-card" for LLM query with 1 row of multiple numeric fields', () => {
    const rows = [{ 金額: 500000, 毛利: 80000, 重量kg: 1200 }];
    expect(detectDisplayMode(rows, 'llm')).toBe('answer-card');
  });

  // LLM with 1 row but has non-numeric values → not answer card
  it('returns "compact" for LLM query with 1 row containing non-numeric values', () => {
    const rows = [{ 客戶名稱: '大潤發', 金額: 500000 }];
    expect(detectDisplayMode(rows, 'llm')).toBe('compact');
  });

  // LLM with 1 row but all null values → not answer card (no values to check)
  it('returns "compact" for LLM query with 1 row of all-null values', () => {
    const rows = [{ 金額: null, 毛利: null }];
    expect(detectDisplayMode(rows, 'llm')).toBe('compact');
  });

  // LLM with 2-19 rows → compact
  it('returns "compact" for LLM query with 2 rows', () => {
    const rows = [{ 客戶名稱: 'A', 金額: 1000 }, { 客戶名稱: 'B', 金額: 2000 }];
    expect(detectDisplayMode(rows, 'llm')).toBe('compact');
  });

  it('returns "compact" for LLM query with 19 rows', () => {
    const rows = Array.from({ length: 19 }, (_, i) => ({ 客戶名稱: `客戶${i}`, 金額: i * 1000 }));
    expect(detectDisplayMode(rows, 'llm')).toBe('compact');
  });

  // LLM with 20+ rows → large
  it('returns "large" for LLM query with 20 rows', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ 商品名稱: `品項${i}`, 數量: i }));
    expect(detectDisplayMode(rows, 'llm')).toBe('large');
  });

  it('returns "large" for LLM query with 100 rows', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    expect(detectDisplayMode(rows, 'llm')).toBe('large');
  });
});
