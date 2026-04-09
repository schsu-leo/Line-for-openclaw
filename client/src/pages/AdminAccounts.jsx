import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import toast from 'react-hot-toast';

const ROLE_LABELS = { admin: '管理員', manager: '部門主管', staff: '同仁' };
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-orange-100 text-orange-700',
  staff: 'bg-blue-100 text-blue-700',
};
function primaryRole(roles = []) {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('manager')) return 'manager';
  return 'staff';
}

const ALL_MODULES = [
  { id: 'cs', label: 'LINE 客服' },
  { id: 'attendance', label: '考勤管理' },
  { id: 'invoice', label: '月結請款' },
  { id: 'db-query', label: '資料查詢' },
];

const DEPT_ORDER = ['管理部', '行政部', '會計部', '業務部', '採購部', '營運部', '物流部', '倉儲部'];
function deptSort(a, b) {
  const ai = DEPT_ORDER.indexOf(a.department);
  const bi = DEPT_ORDER.indexOf(b.department);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
}

export default function AdminAccounts() {
  const { user: currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [modulesTarget, setModulesTarget] = useState(null); // { id, name, modules[] }
  const [createForm, setCreateForm] = useState({ email: '', password: '', name: '', role: 'staff', department: '' });
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
      setCreateForm({ email: '', password: '', name: '', role: 'staff', department: '' });
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

  const handleModulesSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/auth/admins/${modulesTarget.id}/modules`, { modules: modulesTarget.modules });
      setAccounts((prev) => prev.map((a) => a.id === modulesTarget.id ? { ...a, modules: modulesTarget.modules } : a));
      toast.success('模組權限已更新');
      setModulesTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (account, newRole) => {
    try {
      await api.patch(`/auth/admins/${account.id}/role`, { role: newRole });
      setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, roles: [newRole] } : a));
      toast.success('角色已更新');
    } catch (err) {
      toast.error(err.response?.data?.error || '更新失敗');
    }
  };

  return (
    <div className="p-6 max-w-5xl">
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">部門</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">名稱</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">角色</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">建立時間</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...accounts].sort(deptSort).map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{account.department || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {account.name || '—'}
                    {account.id === currentUser?.id && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">你</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{account.email}</td>
                  <td className="px-4 py-3">
                    {account.id === currentUser?.id ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[primaryRole(account.roles)] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[primaryRole(account.roles)] || primaryRole(account.roles)}
                      </span>
                    ) : (
                      <select
                        value={primaryRole(account.roles) || 'staff'}
                        onChange={(e) => handleRoleChange(account, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                      >
                        <option value="admin">管理員</option>
                        <option value="manager">部門主管</option>
                        <option value="staff">同仁</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(account.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {account.id !== currentUser?.id && (
                      <button
                        onClick={() => setModulesTarget({ id: account.id, name: account.name || account.email, modules: account.modules || [] })}
                        className="text-xs text-green-600 hover:text-green-800"
                      >
                        模組
                      </button>
                    )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">部門</label>
                <input
                  type="text"
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="例：管理部、業務部（選填）"
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
                  <option value="manager">部門主管</option>
                  <option value="staff">同仁</option>
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

      {/* 模組權限 Modal */}
      {modulesTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold mb-1">模組權限</h2>
            <p className="text-sm text-gray-500 mb-4">{modulesTarget.name}</p>
            <div className="space-y-2 mb-5">
              {ALL_MODULES.map((mod) => {
                const checked = modulesTarget.modules.includes(mod.id);
                return (
                  <label key={mod.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...modulesTarget.modules, mod.id]
                          : modulesTarget.modules.filter((m) => m !== mod.id);
                        setModulesTarget({ ...modulesTarget, modules: next });
                      }}
                      className="w-4 h-4 accent-green-500"
                    />
                    <span className="text-sm text-gray-700">{mod.label}</span>
                    <span className="text-xs text-gray-400 font-mono ml-auto">{mod.id}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModulesTarget(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleModulesSave}
                disabled={saving}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
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
