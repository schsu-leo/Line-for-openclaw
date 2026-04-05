import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function InvoiceModule() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  // Build iframe URL with portal JWT for FastAPI session bootstrap
  const baseUrl = '/api/inv';
  const iframeSrc = `${baseUrl}/?portal_token=${encodeURIComponent(token || '')}`;

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <iframe
        src={iframeSrc}
        className="w-full h-full border-0"
        title="月結請款系統"
        allow="downloads"
      />
    </div>
  );
}
