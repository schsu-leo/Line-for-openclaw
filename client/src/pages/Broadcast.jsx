import React, { useEffect, useState, useCallback } from 'react';
import api from '../modules/cs/api';
import toast from 'react-hot-toast';

// ── Target selector component ─────────────────────────────────────

function TargetSelector({ selected, onChange }) {
  const [available, setAvailable] = useState({ users: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('user');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/broadcast/targets').then((res) => setAvailable(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isSelected = (target) => selected.some((s) => s.id === target.id);

  const toggle = (target) => {
    if (isSelected(target)) {
      onChange(selected.filter((s) => s.id !== target.id));
    } else {
      onChange([...selected, target]);
    }
  };

  const list = tab === 'user' ? available.users : available.groups;
  const filtered = list.filter((t) => (t.name || '').toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setTab('user')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'user' ? 'bg-white text-green-700 border-b-2 border-green-500' : 'text-gray-500 hover:text-gray-700'}`}
        >
          個人用戶 ({available.users.length})
        </button>
        <button
          onClick={() => setTab('group')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'group' ? 'bg-white text-purple-700 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'}`}
        >
          群組 ({available.groups.length})
        </button>
      </div>
      <div className="p-3 border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋..."
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading ? (
          <p className="text-center py-6 text-gray-400 text-sm">載入中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-6 text-gray-400 text-sm">無資料</p>
        ) : filtered.map((t) => (
          <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected(t)}
              onChange={() => toggle(t)}
              className="w-4 h-4 rounded text-green-500"
            />
            {t.picture_url ? (
              <img src={t.picture_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${tab === 'group' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                {(t.name || '?')[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{t.name || '（未知）'}</p>
              <p className="text-xs text-gray-400 truncate">{t.id}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Broadcast List Manager ────────────────────────────────────────

function BroadcastListManager({ onSelectList, currentTargets }) {
  const [lists, setLists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLists = () => {
    api.get('/broadcast/lists').then((res) => setLists(res.data)).catch(() => {});
  };

  useEffect(() => { fetchLists(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post('/broadcast/lists', { name: newName.trim(), targets: currentTargets });
      toast.success('發送清單已儲存');
      setShowCreate(false);
      setNewName('');
      fetchLists();
    } catch {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCurrent = async (list) => {
    try {
      await api.put(`/broadcast/lists/${list.id}`, { targets: currentTargets });
      toast.success(`已更新「${list.name}」的對象清單`);
      fetchLists();
    } catch {
      toast.error('更新失敗');
    }
  };

  const handleDelete = async (list) => {
    if (!confirm(`確定刪除清單「${list.name}」？`)) return;
    try {
      await api.delete(`/broadcast/lists/${list.id}`);
      toast.success('已刪除');
      fetchLists();
    } catch {
      toast.error('刪除失敗');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">已儲存的對象清單</p>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs text-green-600 hover:underline"
        >
          + 儲存目前對象為新清單
        </button>
      </div>

      {lists.length === 0 ? (
        <p className="text-xs text-gray-400">尚無儲存清單</p>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <div key={list.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium text-gray-800">{list.name}</span>
                {list.is_default && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">預設</span>}
                <span className="ml-2 text-xs text-gray-400">（{(list.targets || []).length} 個對象）</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onSelectList(list.targets || [])} className="text-xs text-blue-500 hover:underline">套用</button>
                <button onClick={() => handleSaveCurrent(list)} className="text-xs text-green-600 hover:underline">更新</button>
                <button onClick={() => handleDelete(list)} className="text-xs text-red-500 hover:underline">刪除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="清單名稱"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
            autoFocus
          />
          <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
            儲存
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            取消
          </button>
        </form>
      )}
    </div>
  );
}

// ── Main Broadcast Page ───────────────────────────────────────────

export default function Broadcast() {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targets, setTargets] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!text.trim() && !imageUrl.trim()) {
      return toast.error('請填寫訊息內容');
    }
    if (targets.length === 0) {
      return toast.error('請選擇至少一個發送對象');
    }
    if (!confirm(`確定要發送訊息給 ${targets.length} 個對象？`)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/broadcast/send', {
        text: text.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        targets,
      });
      setResult(res.data);
      if (res.data.failed === 0) {
        toast.success(`成功發送給 ${res.data.sent} 個對象`);
      } else {
        toast.error(`${res.data.sent} 個成功，${res.data.failed} 個失敗`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || '發送失敗');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">群發訊息</h1>
        <p className="text-sm text-gray-500 mt-0.5">由 Bot 主動推播訊息給指定的用戶或群組</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: compose */}
        <div className="space-y-5">
          {/* Message content */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-800">訊息內容</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">文字訊息</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="輸入要發送的文字訊息..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">圖片 URL（選填）</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <p className="text-xs text-gray-400 mt-1">圖片需為公開可存取的 HTTPS URL，且長寬至少 1 px、最大 10MB</p>
            </div>

            {/* Preview */}
            {(text || imageUrl) && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium">預覽</p>
                {text && <p className="text-sm text-gray-800 whitespace-pre-wrap">{text}</p>}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="max-h-32 rounded object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Send button + result */}
          <button
            onClick={handleSend}
            disabled={sending || targets.length === 0 || (!text.trim() && !imageUrl.trim())}
            className="w-full py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {sending ? '發送中...' : `發送給 ${targets.length} 個對象`}
          </button>

          {result && (
            <div className={`rounded-xl p-4 text-sm ${result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <p className="font-medium">
                ✅ 成功 {result.sent} 個
                {result.failed > 0 && ` ❌ 失敗 ${result.failed} 個`}
              </p>
              {result.failedDetails?.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {result.failedDetails.map((f, i) => (
                    <li key={i}>{f.id}: {f.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right: target selection */}
        <div className="space-y-5">
          {/* Selected summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-800">發送對象</h2>
              {targets.length > 0 && (
                <button onClick={() => setTargets([])} className="text-xs text-red-500 hover:underline">
                  清除全部
                </button>
              )}
            </div>
            {targets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {targets.map((t) => (
                  <span
                    key={t.id}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${t.type === 'group' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}
                  >
                    {t.name || t.id}
                    <button onClick={() => setTargets(targets.filter((s) => s.id !== t.id))} className="ml-0.5 opacity-60 hover:opacity-100">&times;</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">尚未選擇對象</p>
            )}

            <TargetSelector selected={targets} onChange={setTargets} />
          </div>

          {/* Saved lists */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <BroadcastListManager onSelectList={setTargets} currentTargets={targets} />
          </div>
        </div>
      </div>
    </div>
  );
}
