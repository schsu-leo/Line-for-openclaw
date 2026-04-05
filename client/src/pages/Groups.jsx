import React, { useEffect, useState, useCallback } from 'react';
import api from '../modules/cs/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editNote, setEditNote] = useState(null); // { id, note }

  const fetchGroups = useCallback(async (page = 1, q = search) => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (q) params.search = q;
      const res = await api.get('/line-groups', { params });
      setGroups(res.data.groups);
      setPagination(res.data.pagination);
    } catch {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchGroups(1); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchGroups(1, search);
  };

  const toggleActive = async (group) => {
    try {
      const res = await api.patch(`/line-groups/${group.id}/active`, { is_active: !group.is_active });
      setGroups((prev) => prev.map((g) => g.id === group.id ? res.data : g));
    } catch {
      toast.error('更新失敗');
    }
  };

  const saveNote = async () => {
    try {
      const res = await api.patch(`/line-groups/${editNote.id}/note`, { note: editNote.note });
      setGroups((prev) => prev.map((g) => g.id === editNote.id ? res.data : g));
      setEditNote(null);
      toast.success('備註已儲存');
    } catch {
      toast.error('儲存失敗');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">群組管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理 LINE 群組，Bot 加入群組後自動記錄</p>
        </div>
        <span className="text-sm text-gray-400">共 {pagination.total} 個群組</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋群組名稱..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button type="submit" className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600">
          搜尋
        </button>
      </form>

      {/* Group list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">群組</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Group ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">備註</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">最後訊息</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">載入中...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">尚無群組記錄。Bot 加入群組並收到訊息後會自動出現。</td></tr>
            ) : groups.map((group) => (
              <tr key={group.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {group.picture_url ? (
                      <img src={group.picture_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-xs">
                        G
                      </div>
                    )}
                    <span className="font-medium text-gray-800">{group.group_name || '（未知群組）'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{group.line_group_id}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                  {group.note || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {group.last_message_at ? dayjs(group.last_message_at).format('MM/DD HH:mm') : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(group)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                      group.is_active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={group.is_active ? 'Bot 已啟用' : 'Bot 已停用'}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      group.is_active ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditNote({ id: group.id, note: group.note || '' })}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    備註
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.total > pagination.limit && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>共 {pagination.total} 個群組</span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => fetchGroups(pagination.page - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >上一頁</button>
              <button
                disabled={pagination.page * pagination.limit >= pagination.total}
                onClick={() => fetchGroups(pagination.page + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >下一頁</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit note modal */}
      {editNote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">編輯備註</h2>
            <textarea
              value={editNote.note}
              onChange={(e) => setEditNote({ ...editNote, note: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              placeholder="備註（選填）"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditNote(null)} className="px-4 py-2 text-sm border rounded-lg">取消</button>
              <button onClick={saveNote} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
