import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../modules/cs/api';
import toast from 'react-hot-toast';

function StatusBadge({ status }) {
  const map = {
    done: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };
  const labels = { done: '完成', pending: '處理中', error: '錯誤' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function ReportDetail({ reportId, onClose, onRead }) {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/reports/${reportId}`)
      .then((res) => {
        setReport(res.data);
        if (!res.data.is_read) {
          api.patch(`/reports/${reportId}/read`).then(() => onRead(reportId)).catch(() => {});
        }
      })
      .catch(() => toast.error('無法載入報告'))
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );

  if (!report) return null;

  const data = report.report_data || {};
  const conversations = data.conversations || [];
  const fmt = (ts) => new Date(ts).toLocaleString('zh-TW');

  const goToMessages = (conv) => {
    onClose();
    if (conv.source_type === 'group') {
      navigate(`/messages?group_id=${conv.target_id}`);
    } else {
      navigate(`/messages?line_user_id=${conv.target_id}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">訊息報告</h2>
            <p className="text-sm text-gray-500">{fmt(report.period_start)} ～ {fmt(report.period_end)}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">收到訊息 <span className="font-bold text-gray-800">{report.message_count}</span> 則</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">本期間無訊息</p>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${conv.source_type === 'group' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {conv.source_type === 'group' ? '群組' : '個人'}
                      </span>
                      <button
                        onClick={() => goToMessages(conv)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline truncate"
                        title="點擊查看對話紀錄"
                      >
                        {conv.target_name}
                      </button>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{conv.message_count} 則</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-2">
                    <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs mr-1">主題</span>
                    {conv.topic}
                  </p>
                  {conv.summary && (
                    <p className="text-sm text-gray-500 mt-1 pl-1">{conv.summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [triggering, setTriggering] = useState(false);

  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/reports', { params: { page, limit: 20 } });
      setReports(res.data.reports);
      setPagination(res.data.pagination);
    } catch {
      toast.error('無法載入報告列表');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(1); }, [fetchReports]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.post('/reports/trigger');
      toast.success('報告生成中，約 30 秒後重新整理');
      setTimeout(() => fetchReports(1), 10000);
    } catch {
      toast.error('觸發失敗');
    } finally {
      setTriggering(false);
    }
  };

  const handleRead = (reportId) => {
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, is_read: true } : r));
  };

  const fmt = (ts) => new Date(ts).toLocaleString('zh-TW');
  const unreadCount = reports.filter((r) => r.status === 'done' && !r.is_read).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">訊息報告</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                {unreadCount} 未讀
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">每小時自動整理一次，含 AI 主題分類</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchReports(pagination.page)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            重新整理
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {triggering ? '生成中...' : '立即生成'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p>尚無報告。系統將於每小時整點自動生成。</p>
          <p className="text-sm mt-1">或點擊「立即生成」手動觸發。</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-6"></th>
                <th className="text-left px-4 py-3 font-medium">期間</th>
                <th className="text-center px-4 py-3 font-medium">訊息數</th>
                <th className="text-center px-4 py-3 font-medium">狀態</th>
                <th className="text-left px-4 py-3 font-medium">建立時間</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => {
                const isUnread = r.status === 'done' && !r.is_read;
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${isUnread ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      {isUnread && (
                        <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full" title="未讀" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {fmt(r.period_start)}
                      </span>
                      <span className="text-gray-400 mx-1">～</span>
                      <span className={`${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {fmt(r.period_end)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{r.message_count}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={r.status} />
                      {r.status === 'error' && r.error_message && (
                        <p className="text-xs text-red-500 mt-0.5">{r.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmt(r.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'done' && (
                        <button
                          onClick={() => setSelectedId(r.id)}
                          className={`font-medium ${isUnread ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                        >
                          {isUnread ? '查看 🔴' : '查看'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pagination.total > pagination.limit && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
              <span>共 {pagination.total} 份報告</span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => fetchReports(pagination.page - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >上一頁</button>
                <button
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  onClick={() => fetchReports(pagination.page + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >下一頁</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedId && (
        <ReportDetail
          reportId={selectedId}
          onClose={() => setSelectedId(null)}
          onRead={handleRead}
        />
      )}
    </div>
  );
}
