import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      const redirect = searchParams.get('redirect');
      if (redirect && (redirect.startsWith('/m/') || redirect.startsWith('/invoice'))) {
        navigate(redirect);
      } else {
        navigate('/');
      }
    } catch (err) {
      const msg = err.response?.status === 429
        ? '登入嘗試過多，請 15 分鐘後再試'
        : (err.response?.data?.error || '登入失敗');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="尚仁蔬果" className="h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-semibold">尚仁蔬果系統 Portal</h1>
          <p className="text-gray-500 text-sm mt-1">管理後台登錄</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電子信箱</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => toast('請聯繫系統管理員重設密碼', { icon: 'ℹ️' })}
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            忘記密碼？
          </button>
        </div>
      </div>
    </div>
  );
}
