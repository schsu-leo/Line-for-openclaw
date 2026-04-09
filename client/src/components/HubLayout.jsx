// LINE智能客服/client/src/components/HubLayout.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function HubLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 薄頂部列：52px */}
      <header className="bg-white border-b border-gray-200 flex items-center px-5 gap-3 flex-shrink-0" style={{ height: 52 }}>
        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <img src="/logo.png" alt="尚仁蔬果" className="h-7 object-contain" />
          <span className="text-sm font-semibold text-gray-800">尚仁管理平台</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user?.name || user?.email}</span>
          <span className="text-gray-300">|</span>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700 text-xs">登出</button>
        </div>
      </header>

      {/* 內容 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
