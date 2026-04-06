import React from 'react';

export default function AttendanceModule() {
  return (
    <div className="w-full h-full -m-6">
      <iframe
        src="/attendance/dashboard"
        title="考勤管理"
        className="w-full h-full border-0"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      />
    </div>
  );
}
