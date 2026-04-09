import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { MessageCircle, Users, FileText, Search } from 'lucide-react';

const modules = [
  {
    id: 'cs',
    name: 'LINE 智能客服',
    description: '客戶訊息管理、AI 自動回覆、知識庫、群發訊息',
    Icon: MessageCircle,
    path: '/m/cs',
    color: 'bg-primary-50 border-primary-200 hover:border-primary-400',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  {
    id: 'attendance',
    name: '考勤管理',
    description: '打卡紀錄、排班管理、請假審核、薪資條',
    Icon: Users,
    path: '/m/attendance',
    color: 'bg-primary-50 border-primary-200 hover:border-primary-400',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  {
    id: 'invoice',
    name: '月結請款',
    description: '月結明細 PDF 產生、發票管理、LINE 發送',
    Icon: FileText,
    path: '/invoice',
    color: 'bg-primary-50 border-primary-200 hover:border-primary-400',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  {
    id: 'db-query',
    name: '資料查詢',
    description: '視覺篩選 + AI 自然語言查詢資料庫，支援 CSV/XLSX 匯出',
    Icon: Search,
    path: '/db-query',
    color: 'bg-primary-50 border-primary-200 hover:border-primary-400',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
];

export default function PortalHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.roles?.includes('admin') ?? false;
  const userModules = user?.modules || [];

  const visibleModules = modules.filter(
    (m) => isAdmin || userModules.includes(m.id)
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          {user?.name || user?.email}，歡迎回來
        </h1>
        <p className="text-gray-500 mt-1">選擇要使用的功能模組</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleModules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => navigate(mod.path)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${mod.color}`}
          >
            <div className={`w-12 h-12 ${mod.iconBg} rounded-lg flex items-center justify-center mb-4`}>
              <mod.Icon className={`w-6 h-6 ${mod.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">{mod.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{mod.description}</p>
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">系統管理</h3>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/accounts')}
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              帳號管理
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
