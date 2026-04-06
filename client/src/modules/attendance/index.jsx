import React from 'react';

export default function AttendanceModule() {
  const token = localStorage.getItem('token');
  const iframeSrc = `/attendance/dashboard?portal_token=${encodeURIComponent(token || '')}`;

  return (
    <div className="w-full h-full -m-6">
      <iframe
        src={iframeSrc}
        title="考勤管理"
        className="w-full h-full border-0"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      />
    </div>
  );
}
