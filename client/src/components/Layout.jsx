import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const portalNav = [
  { path: '/', label: '首頁', icon: '🏠', exact: true },
];

const csNav = [
  { path: '/cs', label: '儀表板', icon: '📊', exact: true },
  { path: '/cs/users', label: '用戶管理', icon: '👤' },
  { path: '/cs/groups', label: '群組管理', icon: '👾' },
  { path: '/cs/messages', label: '訊息紀錄', icon: '💬' },
  { path: '/cs/schedules', label: '排程設定', icon: '🕐' },
  { path: '/cs/knowledge', label: '知識庫', icon: '📚' },
  { path: '/cs/reports', label: '訊息報告', icon: '📋' },
  { path: '/cs/broadcast', label: '群發訊息', icon: '📢' },
  { path: '/cs/settings', label: '系統設定', icon: '⚙️', adminOnly: true },
];

const attendanceNav = [
  { path: '/attendance', label: '總覽', icon: '📊', exact: true },
  { path: '/attendance/employees', label: '員工管理', icon: '👥' },
  { path: '/attendance/clock-records', label: '打卡紀錄', icon: '⏰' },
  { path: '/attendance/shifts', label: '班別管理', icon: '📅' },
  { path: '/attendance/schedules', label: '排班表', icon: '🗓️' },
  { path: '/attendance/approvals', label: '簽核中心', icon: '✅' },
  { path: '/attendance/leaves', label: '假勤總覽', icon: '🏖️' },
  { path: '/attendance/reports', label: '月報表', icon: '📈' },
  { path: '/attendance/onboard', label: '新人報到', icon: '🆕' },
  { path: '/attendance/payslips', label: '薪資條', icon: '💰' },
  { path: '/attendance/settings', label: '系統設定', icon: '⚙️', adminOnly: true },
];

const invoiceNav = [
  { path: '/invoice', label: '月結請款', icon: '📄', exact: true },
];

const adminNav = [
  { path: '/admin/accounts', label: '帳號管理', icon: '🔐' },
];

function NavSection({ title, items, isAdmin, location }) {
  const isInSection = items.some((item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  });

  const [expanded, setExpanded] = useState(isInSection);

  useEffect(() => {
    if (isInSection) setExpanded(true);
  }, [isInSection]);

  const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);
  if (visibleItems.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
      >
        <span>{title}</span>
        <span className="text-[10px]">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const userModules = user?.modules || [];
  const hasModule = (mod) => isAdmin || userModules.includes(mod);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 w-full text-left">
            <div className="h-8 w-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              SR
            </div>
            <div>
              <p className="font-semibold text-sm">尚仁管理平台</p>
              <p className="text-xs text-gray-500">Shang Ren Portal</p>
            </div>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {/* Portal */}
          {portalNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Module sections */}
          {hasModule('cs') && (
            <NavSection title="LINE 客服" items={csNav} isAdmin={isAdmin} location={location} />
          )}
          {hasModule('attendance') && (
            <NavSection title="考勤管理" items={attendanceNav} isAdmin={isAdmin} location={location} />
          )}
          {hasModule('invoice') && (
            <NavSection title="月結請款" items={invoiceNav} isAdmin={isAdmin} location={location} />
          )}
          {isAdmin && (
            <NavSection title="系統管理" items={adminNav} isAdmin={isAdmin} location={location} />
          )}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-medium">{user?.name?.[0] || user?.email?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name || user?.email}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700">
              登出
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
