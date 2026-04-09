import React from 'react';

function formatNumber(value) {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

export default function AnswerCard({ row, onExpand, onExport, exporting }) {
  const entries = Object.entries(row).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex gap-4 flex-wrap flex-1">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex-1 min-w-40 bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-center"
            >
              <div className="text-xs text-gray-500 mb-1">{key}</div>
              <div className="text-2xl font-bold text-green-700">
                {formatNumber(value)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onExpand}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            展開明細
          </button>
          <button
            onClick={() => onExport('csv')}
            disabled={exporting}
            className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => onExport('xlsx')}
            disabled={exporting}
            className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            ⬇ XLSX
          </button>
        </div>
      </div>
    </div>
  );
}
