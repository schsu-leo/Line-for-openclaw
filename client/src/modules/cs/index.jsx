import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import Users from '../../pages/Users';
import Groups from '../../pages/Groups';
import Messages from '../../pages/Messages';
import Schedules from '../../pages/Schedules';
import Knowledge from '../../pages/Knowledge';
import Reports from '../../pages/Reports';
import Broadcast from '../../pages/Broadcast';
import Settings from '../../pages/Settings';

export default function CSModule() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="users" element={<Users />} />
      <Route path="groups" element={<Groups />} />
      <Route path="messages" element={<Messages />} />
      <Route path="schedules" element={<Schedules />} />
      <Route path="knowledge" element={<Knowledge />} />
      <Route path="reports" element={<Reports />} />
      <Route path="broadcast" element={<Broadcast />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/cs" replace />} />
    </Routes>
  );
}
