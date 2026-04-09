import React, { useState } from 'react';

const CHIPS = [
  '今天的出貨',
  '本月出貨明細',
  '查詢特定客戶的出貨',
  '毛利最高的前 10 筆商品',
  '本月出貨總金額',
];

export default function LLMQuery({ onSubmit, loading }) {
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    if (!query.trim()) return;
    onSubmit(query.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="用中文描述你想查的資料，例如：查上個月出貨給台北客戶的品項…"
          rows={3}
          className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent leading-relaxed"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="absolute right-3 bottom-3 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>✨</span>
          )}
          送出
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setQuery(chip)}
            className="text-xs px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full hover:bg-green-100 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400">Ctrl+Enter 送出</p>
    </div>
  );
}
