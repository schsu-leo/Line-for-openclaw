import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import toast from 'react-hot-toast';
import VisualFilter from './VisualFilter';
import LLMQuery from './LLMQuery';
import ResultTable from './ResultTable';
import AdminSettings from './AdminSettings';

const HISTORY_KEY = 'db_query_history';
const MAX_HISTORY = 10;

function getThisMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstDay = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { firstDay, lastDay };
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveHistory(entry) {
  const history = loadHistory();
  const updated = [entry, ...history.filter((h) => h.query !== entry.query)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export default function DBQuery() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [schema, setSchema] = useState([]);
  const [activeTab, setActiveTab] = useState('visual');
  const [filters, setFilters] = useState([]);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(loadHistory());

  // Track query payload for export
  const queryMode = useRef('visual');
  const queryPayload = useRef({});

  useEffect(() => { fetchTables(); }, []);

  useEffect(() => {
    if (selectedTable) fetchSchema(selectedTable);
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      const res = await api.get('/db-query/tables');
      const list = res.data.tables;
      setTables(list);
      if (list.length) setSelectedTable(list[0]);
    } catch {
      toast.error('無法載入資料表清單');
    }
  };

  const fetchSchema = async (table) => {
    try {
      const res = await api.get(`/db-query/schema/${table}`);
      const cols = res.data.columns;
      setSchema(cols);
      if (table === 'v_shipment_detail') {
        const { firstDay, lastDay } = getThisMonthRange();
        setFilters([
          { column: '日期', operator: '>=', value: firstDay },
          { column: '日期', operator: '<=', value: lastDay },
        ]);
      } else if (cols.length) {
        setFilters([{ column: cols[0].column_name, operator: 'contains', value: '' }]);
      } else {
        setFilters([]);
      }
      setSortBy('');
      setResult(null);
    } catch {
      setSchema([]);
    }
  };

  const runVisual = async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      const payload = { table: selectedTable, filters, sortBy, sortDir };
      const res = await api.post('/db-query/query/visual', payload);
      setResult(res.data);
      queryMode.current = 'visual';
      queryPayload.current = payload;
    } catch (e) {
      toast.error(e.response?.data?.error || '查詢失敗');
    } finally {
      setLoading(false);
    }
  };

  const runLLM = async (query) => {
    setLoading(true);
    try {
      const res = await api.post('/db-query/query/llm', { query });
      setResult(res.data);
      queryMode.current = 'llm';
      queryPayload.current = { sql: res.data.sql };
      // Save to history
      const entry = { query, time: new Date().toISOString() };
      saveHistory(entry);
      setHistory(loadHistory());
    } catch (e) {
      toast.error(e.response?.data?.error || 'AI 查詢失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    if (schema.length) {
      setFilters([{ column: schema[0].column_name, operator: 'contains', value: '' }]);
    }
    setResult(null);
  };

  if (!tables.length && !loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-64 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <p className="text-gray-600 text-sm font-medium mb-1">您的帳號尚未配置查詢權限</p>
        <p className="text-gray-400 text-xs">請聯繫管理員設定部門查詢權限</p>
        {isAdmin && (
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-4 px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            前往設定
          </button>
        )}
        {showAdmin && <AdminSettings onClose={() => { setShowAdmin(false); fetchTables(); }} />}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">資料查詢</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? '管理員模式 — 可查詢全部資料表' : `部門：${user?.department || '未設定'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* History dropdown */}
          {history.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                🕐 查詢紀錄
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-72 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-600">最近查詢</div>
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveTab('llm');
                        setShowHistory(false);
                        runLLM(h.query);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-green-50 border-b border-gray-50 last:border-0"
                    >
                      <div className="truncate">{h.query}</div>
                      <div className="text-gray-400 text-[10px] mt-0.5">{new Date(h.time).toLocaleString('zh-TW')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ⚙️ 管理設定
            </button>
          )}
        </div>
      </div>

      {/* Query panel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table selector */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">資料表</span>
          <select
            value={selectedTable}
            onChange={(e) => { setSelectedTable(e.target.value); setResult(null); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 min-w-48"
          >
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 font-mono">{schema.length} 個欄位</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          {[['visual', '🎛️ 視覺篩選'], ['llm', '✨ AI 自然語言']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 text-sm border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-green-500 text-green-600 font-medium bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="p-5">
          {activeTab === 'visual' && (
            <VisualFilter columns={schema} filters={filters} onChange={setFilters} />
          )}
          {activeTab === 'llm' && (
            <LLMQuery onSubmit={runLLM} loading={loading} />
          )}
        </div>

        {/* Action bar (visual only) */}
        {activeTab === 'visual' && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
            <button
              onClick={runVisual}
              disabled={loading || !selectedTable}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : '▶'}
              執行查詢
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
            >
              ↺ 清除
            </button>

            {/* Sort */}
            {schema.length > 0 && (
              <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                <span>排序</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">（不排序）</option>
                  {schema.map((c) => (
                    <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
                  ))}
                </select>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="desc">降冪</option>
                  <option value="asc">升冪</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <ResultTable
          result={result}
          queryMode={queryMode.current}
          queryPayload={queryPayload.current}
        />
      )}

      {/* Admin modal */}
      {showAdmin && (
        <AdminSettings onClose={() => { setShowAdmin(false); fetchTables(); }} />
      )}
    </div>
  );
}
