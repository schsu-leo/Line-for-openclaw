import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini', model: 'gemini-2.0-flash' },
  { value: 'openai', label: 'OpenAI', model: 'gpt-4o-mini' },
  { value: 'claude', label: 'Claude (Anthropic)', model: 'claude-haiku-4-5-20251001' },
];

export default function AdminSettings({ onClose }) {
  const [tab, setTab] = useState('permissions'); // 'permissions' | 'llm'
  const [permissions, setPermissions] = useState([]);
  const [allTables, setAllTables] = useState([]);
  const [editing, setEditing] = useState(null); // { department, allowed_tables, hidden_columns }
  const [llmConfig, setLlmConfig] = useState({ provider: 'gemini', model: 'gemini-2.0-flash', api_key: '' });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allDepts, setAllDepts] = useState([]);
  const [deptCustom, setDeptCustom] = useState(false);

  useEffect(() => {
    loadPermissions();
    loadLLMConfig();
    loadDepartments();
  }, []);

  const loadPermissions = async () => {
    const res = await api.get('/db-query/admin/permissions');
    setPermissions(res.data.permissions);
    setAllTables(res.data.all_tables);
  };

  const loadLLMConfig = async () => {
    const res = await api.get('/db-query/admin/llm-config');
    setLlmConfig({ provider: res.data.provider, model: res.data.model, api_key: '' });
    setHasApiKey(res.data.has_api_key);
  };

  const loadDepartments = async () => {
    try {
      const res = await api.get('/auth/departments');
      setAllDepts(res.data);
    } catch {}
  };

  const startEdit = (perm) => {
    setDeptCustom(false);
    setEditing({
      department: perm?.department || '',
      allowed_tables: perm?.allowed_tables || [],
      hidden_columns: perm?.hidden_columns || {},
      isNew: !perm,
    });
  };

  const savePermission = async () => {
    if (!editing.department.trim()) return toast.error('請填寫部門名稱');
    setSaving(true);
    try {
      await api.put('/db-query/admin/permissions', editing);
      toast.success('已儲存');
      setEditing(null);
      loadPermissions();
    } catch (e) {
      toast.error(e.response?.data?.error || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const deletePermission = async (department) => {
    if (!confirm(`確定刪除「${department}」的查詢權限設定？`)) return;
    await api.delete(`/db-query/admin/permissions/${encodeURIComponent(department)}`);
    toast.success('已刪除');
    loadPermissions();
  };

  const toggleTable = (table) => {
    const current = editing.allowed_tables;
    setEditing({
      ...editing,
      allowed_tables: current.includes(table)
        ? current.filter((t) => t !== table)
        : [...current, table],
    });
  };

  const saveLLMConfig = async () => {
    setSaving(true);
    try {
      await api.put('/db-query/admin/llm-config', llmConfig);
      setHasApiKey(!!llmConfig.api_key || hasApiKey);
      setLlmConfig((c) => ({ ...c, api_key: '' }));
      toast.success('LLM 設定已儲存');
    } catch (e) {
      toast.error(e.response?.data?.error || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const testLLM = async () => {
    setTesting(true);
    try {
      await api.post('/db-query/admin/llm-config/test');
      toast.success('LLM 連線測試成功');
    } catch (e) {
      toast.error(`測試失敗：${e.response?.data?.error || e.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">資料查詢 — 管理設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {[['permissions', '部門權限'], ['llm', 'AI 語言模型']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`py-3 px-4 text-sm mr-2 border-b-2 transition-colors ${
                tab === key ? 'border-green-500 text-green-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Permissions Tab */}
          {tab === 'permissions' && !editing && (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">設定各部門可查詢的資料表及遮蔽欄位</p>
                <button
                  onClick={() => startEdit(null)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  ＋ 新增部門
                </button>
              </div>

              {permissions.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">尚未設定任何部門權限</div>
              )}

              {permissions.map((perm) => (
                <div key={perm.department} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-800">{perm.department}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(perm)}
                        className="text-xs px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => deletePermission(perm.department)}
                        className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(perm.allowed_tables || []).map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full">
                        {t}
                      </span>
                    ))}
                    {!(perm.allowed_tables?.length) && (
                      <span className="text-xs text-gray-400">無可查詢的資料表</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Permission Edit */}
          {tab === 'permissions' && editing && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">部門名稱</label>
                {editing.isNew && !deptCustom ? (
                  <select
                    value={editing.department}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setDeptCustom(true);
                        setEditing({ ...editing, department: '' });
                      } else {
                        setEditing({ ...editing, department: e.target.value });
                      }
                    }}
                    className="input-field"
                  >
                    <option value="">— 選擇部門 —</option>
                    {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
                    <option value="__custom__">自訂部門名稱…</option>
                  </select>
                ) : editing.isNew && deptCustom ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editing.department}
                      onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                      placeholder="輸入自訂部門名稱"
                      className="input-field flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setDeptCustom(false); setEditing({ ...editing, department: '' }); }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2"
                    >
                      ← 返回
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editing.department}
                    disabled
                    className="input-field disabled:bg-gray-50 disabled:text-gray-500"
                  />
                )}
                <p className="text-xs text-gray-400 mt-1">需與用戶帳號的「部門」欄位完全一致</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  可查詢的資料表 ({editing.allowed_tables.length}/{allTables.length})
                </label>
                <div className="border border-gray-200 rounded-xl p-3 max-h-52 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1">
                    {allTables.map((table) => (
                      <label key={table} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={editing.allowed_tables.includes(table)}
                          onChange={() => toggleTable(table)}
                          className="accent-green-500"
                        />
                        <span className="text-xs font-mono text-gray-700">{table}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  取消
                </button>
                <button
                  onClick={savePermission}
                  disabled={saving}
                  className="flex-1 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>
          )}

          {/* LLM Tab */}
          {tab === 'llm' && (
            <div className="space-y-5 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
                <select
                  value={llmConfig.provider}
                  onChange={(e) => {
                    const prov = PROVIDERS.find((p) => p.value === e.target.value);
                    setLlmConfig({ ...llmConfig, provider: e.target.value, model: prov?.model || '' });
                  }}
                  className="input-field"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型名稱</label>
                <input
                  type="text"
                  value={llmConfig.model}
                  onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })}
                  className="input-field"
                  placeholder="例如：gemini-2.0-flash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key {hasApiKey && <span className="text-xs text-green-600 font-normal ml-1">（已設定）</span>}
                </label>
                <input
                  type="password"
                  value={llmConfig.api_key}
                  onChange={(e) => setLlmConfig({ ...llmConfig, api_key: e.target.value })}
                  className="input-field"
                  placeholder={hasApiKey ? '留空則保留現有 Key' : '輸入 API Key'}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={testLLM}
                  disabled={testing || !hasApiKey}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {testing ? '測試中…' : '測試連線'}
                </button>
                <button
                  onClick={saveLLMConfig}
                  disabled={saving}
                  className="flex-1 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? '儲存中…' : '儲存設定'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
