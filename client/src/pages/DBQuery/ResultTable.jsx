import React, { useState, useMemo, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import AnswerCard from './AnswerCard';

const PAGE_SIZE = 20;

function detectDisplayMode(rows, queryMode) {
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

export default function ResultTable({ result, queryMode, queryPayload }) {
  const [page, setPage] = useState(1);
  const [showSQL, setShowSQL] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedCols, setSelectedCols] = useState(null); // null = auto (suggested_columns)
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { rows = [], total_count = 0, sql, suggested_columns } = result;
  const displayMode = detectDisplayMode(rows, queryMode);

  useEffect(() => {
    setExpanded(false);
  }, [rows]);

  // Determine which columns to display
  const allColumns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);
  const displayColumns = useMemo(() => {
    if (selectedCols) return selectedCols;
    if (suggested_columns?.length) {
      return suggested_columns.filter((c) => allColumns.includes(c));
    }
    return allColumns;
  }, [selectedCols, suggested_columns, allColumns]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const response = await api.post(
        '/db-query/export',
        { format, mode: queryMode, ...queryPayload },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${Date.now()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('匯出失敗，請重試');
    } finally {
      setExporting(false);
    }
  };

  const formatCell = (value) => {
    if (value === null || value === undefined) return <span className="text-gray-300 italic text-xs">null</span>;
    if (typeof value === 'boolean') return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {value ? 'true' : 'false'}
      </span>
    );
    const str = String(value);
    if (str.length > 80) return <span title={str}>{str.slice(0, 80)}…</span>;
    return str;
  };

  return (
    <>
      {/* Answer Card mode — 1 numeric row, LLM only */}
      {displayMode === 'answer-card' && !expanded && (
        <AnswerCard
          row={rows[0]}
          onExpand={() => setExpanded(true)}
          onExport={handleExport}
        />
      )}

      {/* Large result mode — ≥ 20 rows, collapsed by default */}
      {displayMode === 'large' && !expanded && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            共 <strong className="text-gray-800">{total_count.toLocaleString()}</strong> 筆
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(true)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
            >
              ▾ 展開表格
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              ⬇ CSV
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              disabled={exporting}
              className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              ⬇ XLSX
            </button>
          </div>
        </div>
      )}

      {(displayMode === 'table' || displayMode === 'compact' || expanded) && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="text-sm text-gray-600">
          查詢結果：共 <strong className="text-gray-800">{total_count.toLocaleString()}</strong> 筆
          {total_count > 500 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs">
              ⚠️ 顯示前 500 筆，匯出可取得完整資料
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Column picker */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span>📋</span> 選欄 ({displayColumns.length}/{allColumns.length})
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-56 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">顯示欄位</span>
                  <button
                    onClick={() => setSelectedCols(null)}
                    className="text-xs text-green-600 hover:underline"
                  >
                    重設（AI 建議）
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {allColumns.map((col) => {
                    const checked = displayColumns.includes(col);
                    return (
                      <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = selectedCols || displayColumns;
                            setSelectedCols(
                              e.target.checked
                                ? [...current, col]
                                : current.filter((c) => c !== col)
                            );
                          }}
                          className="accent-green-500"
                        />
                        <span className="text-xs text-gray-700 font-mono">{col}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            ⬇ XLSX
          </button>
        </div>
      </div>

      {/* SQL collapse */}
      {sql && (
        <div className="px-5 border-b border-gray-100">
          <button
            onClick={() => setShowSQL(!showSQL)}
            className="py-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            <span>{showSQL ? '▼' : '▶'}</span> {showSQL ? '隱藏' : '查看'} 生成的 SQL
          </button>
          {showSQL && (
            <pre className="mb-3 bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto leading-relaxed font-mono">
              {sql}
            </pre>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {displayColumns.map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(displayMode === 'compact' && !expanded
              ? pageRows.slice(0, 5)
              : pageRows
            ).map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-green-50/30 transition-colors">
                {displayColumns.map((col) => (
                  <td key={col} className="px-4 py-2.5 text-xs text-gray-700 max-w-xs truncate">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {displayMode === 'compact' && !expanded && rows.length > 5 && (
              <tr>
                <td
                  colSpan={displayColumns.length}
                  className="px-4 py-2.5 text-center"
                >
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-xs text-green-600 hover:underline"
                  >
                    ▾ 展開全部 {rows.length} 筆
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
          <span className="text-xs text-gray-500">
            顯示 {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, rows.length)} / {rows.length} 筆
          </span>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs border rounded-md transition-colors ${
                    p === page
                      ? 'bg-green-500 text-white border-green-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
      )}
    </>
  );
}
