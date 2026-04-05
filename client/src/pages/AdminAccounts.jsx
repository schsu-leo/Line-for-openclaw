import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import toast from 'react-hot-toast';

const ROLE_LABELS = { admin: '管理員', '正職': '正職', PT: 'PT' };
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  '正職': 'bg-blue-100 text-blue-700',
  PT: 'bg-gray-100 text-gray-600',
};

export default function AdminAccounts() {
  const { user: currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [createForm, setCreateForm] = useState({ email: '', password: '', name: '', role: 'admin' });
  const [resetPassword, setResetPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/auth/admins');
      setAccounts(res.data);
    } catch {
      toast.error('無法載入帳號列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password) return toast.error('Email 和密碼為必填');
    if (createForm.password.length < 8) return toast.error('密碼至少需要 8 個字元');
    setSaving(true);
    try {
      await api.post('/auth/admins', createForm);
      toast.success('帳號建立成功，該帳號首次登入需修改密碼');
      setShowCreate(false);
      setCreateForm({ email: '', password: '', name: '', role: 'admin' });
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account) => {
    if (!confirm(`確定要刪除帳號「${account.email}」？此操作無法復原。`)) return;
    try {
      await api.delete(`/auth/admins/${account.id}`);
      toast.success('帳號已刪除');
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || '刪除失敗');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPassword || resetPassword.length < 8) return toast.error('新密碼至少需要 8 個字元');
    setSaving(true);
    try {
      await api.put(`/auth/admins/${resetTarget.id}/password`, { newPassword: resetPassword });
      toast.success('密碼已重設，該帳號下次登入需修改密碼');
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || '重設失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (account, newRole) => {
    try {
      await api.patch(`/auth/admins/${account.id}/role`, { role: newRole });
      setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, role: newRole } : a));
      toast.success('角色已更新');
    } catch (err) {
      toast.error(err.response?.data?.error || '更新失敗');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">帳號管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理後台登入帳號與角色</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + 新增帳號
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">尚無帳號</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">名稱</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">角色</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">建立時間</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {account.name || '—'}
                    {account.id === currentUser?.id && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">你</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{account.email}</td>
                  <td className="px-4 py-3">
                    {account.id === currentUser?.id ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[account.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[account.role] || account.role}
                      </span>
                    ) : (
                      <select
                        value={account.role || 'admin'}
                        onChange={(e) => handleRoleChange(account, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                      >
                        <option value="admin">管理員</option>
                        <option value="正職">正職</option>
                        <option value="PT">PT</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(account.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => { setResetTarget(account); setResetPassword(''); }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      重設密碼
                    </button>
                    {account.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(account)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        刪除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新增帳號 Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">新增帳號</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="顯示名稱（選填）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">初始密碼</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="至少 8 個字元"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="admin">管理員</option>
                  <option value="正職">正職</option>
                  <option value="PT">PT</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">新帳號首次登入時將被要求修改密碼。</p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {saving ? '建立中...' : '建立帳號'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 重設密碼 Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-1">重設密碼</h2>
            <p className="text-sm text-gray-500 mb-4">{resetTarget.email}</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="至少 8 個字元"
                  required
                />
              </div>
              <p className="text-xs text-gray-400">重設後該帳號下次登入時將被要求再次修改密碼。</p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {saving ? '重設中...' : '確認重設'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
