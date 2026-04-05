import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import ChangePassword from './pages/ChangePassword';
import PortalHome from './components/PortalHome';
import api from './services/api';

// Lazy-loaded modules
const CSModule = lazy(() => import('./modules/cs'));
const AttendanceModule = lazy(() => import('./modules/attendance'));
const InvoiceModule = lazy(() => import('./modules/invoice'));

// Admin pages (kept at portal level)
const AdminAccounts = lazy(() => import('./pages/AdminAccounts'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function PrivateRoute({ children, adminOnly = false, module: moduleName }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.requiresPasswordChange) return <Navigate to="/change-password" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (moduleName && user.role !== 'admin') {
    const userModules = user.modules || [];
    if (!userModules.includes(moduleName)) return <Navigate to="/" replace />;
  }
  return <Layout>{children}</Layout>;
}

function DefaultRedirect() {
  const [checking, setChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(true);

  useEffect(() => {
    api.get('/setup/status')
      .then((res) => setSetupComplete(res.data.setupComplete))
      .catch(() => setSetupComplete(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <Loading />;
  return <Navigate to={setupComplete ? '/' : '/setup'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public */}
            <Route path="/setup" element={<Setup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />

            {/* Portal Home */}
            <Route path="/" element={<PrivateRoute><PortalHome /></PrivateRoute>} />

            {/* CS Module */}
            <Route path="/cs/*" element={<PrivateRoute module="cs"><CSModule /></PrivateRoute>} />

            {/* Attendance Module */}
            <Route path="/attendance/*" element={<PrivateRoute module="attendance"><AttendanceModule /></PrivateRoute>} />

            {/* Invoice Module */}
            <Route path="/invoice/*" element={<PrivateRoute module="invoice"><InvoiceModule /></PrivateRoute>} />

            {/* Admin */}
            <Route path="/admin/accounts" element={<PrivateRoute adminOnly><AdminAccounts /></PrivateRoute>} />

            {/* Fallback */}
            <Route path="/init" element={<DefaultRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
