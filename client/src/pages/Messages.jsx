import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../modules/cs/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

function SearchBox({ placeholder, items, labelKey, valueKey, value, onSelect, onClear, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = items.find((i) => i[valueKey] === value);
  const filtered = query
    ? items.filter((i) => (i[labelKey] || i[valueKey] || '').toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div className={`flex items-center gap-1 border rounded-lg px-3 py-2 text-sm ${disabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-green-400 bg-green-50 text-green-800'}`}>
        <span className="truncate max-w-[140px]">{selected[labelKey] || selected[valueKey]}</span>
        {!disabled && (
          <button onClick={onClear} className="ml-1 text-green-600 hover:text-red-500 font-bold leading-none text-base">&times;</button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className={`border rounded-lg px-3 py-2 text-sm focus:outline-none w-44 ${disabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-green-500'}`}
      />
      {open && !disabled && filtered.length > 0 && (
        <ul className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto w-56">
          {filtered.map((item) => (
            <li
              key={item[valueKey]}
              onMouseDown={() => { onSelect(item[valueKey]); setQuery(''); setOpen(false); }}
              className="px-3 py-2 text-sm hover:bg-green-50 cursor-pointer truncate"
            >
              {item[labelKey] || item[valueKey]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Messages() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(searchParams.get('line_user_id') || '');
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('group_id') || '');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef(null);

  const hasFilter = selectedUser || selectedGroup;

  useEffect(() => {
    api.get('/line-users', { params: { limit: 200 } }).then((res) => setUsers(res.data.users || [])).catch(() => {});
    api.get('/line-groups', { params: { limit: 200 } }).then((res) => setGroups(res.data.groups || [])).catch(() => {});
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!hasFilter) { setMessages([]); setPagination({}); return; }
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (selectedUser) { params.line_user_id = selectedUser; params.source_type = 'user'; }
      if (selectedGroup) { params.group_id = selectedGroup; params.source_type = 'group'; }
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;

      const res = await api.get('/messages', { params });
      setMessages(res.data.messages.reverse());
      setPagination(res.data.pagination);
    } catch {
      toast.error('載入失敗', { id: 'messages-fetch-error' });
    } finally {
      setLoading(false);
    }
  }, [selectedUser, selectedGroup, dateRange, page, hasFilter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const exportCSV = async () => {
    try {
      const params = {};
      if (selectedUser) params.line_user_id = selectedUser;
      if (selectedGroup) params.group_id = selectedGroup;
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const res = await api.get('/messages/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `messages_${dayjs().format('YYYYMMDD')}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('匯出失敗'); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">訊息紀錄</h1>
        <button onClick={exportCSV} disabled={!hasFilter} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-40">
          匯出 CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <SearchBox
          placeholder="搜尋用戶..."
          items={users}
          labelKey="display_name"
          valueKey="line_user_id"
          value={selectedUser}
          onSelect={(v) => { setSelectedUser(v); setSelectedGroup(''); setPage(1); }}
          onClear={() => { setSelectedUser(''); setPage(1); }}
          disabled={!!selectedGroup}
        />
        <SearchBox
          placeholder="搜尋群組..."
          items={groups}
          labelKey="group_name"
          valueKey="line_group_id"
          value={selectedGroup}
          onSelect={(v) => { setSelectedGroup(v); setSelectedUser(''); setPage(1); }}
          onClear={() => { setSelectedGroup(''); setPage(1); }}
          disabled={!!selectedUser}
        />
        <input type="date" value={dateRange.start}
          onChange={(e) => { setDateRange((d) => ({ ...d, start: e.target.value })); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <input type="date" value={dateRange.end}
          onChange={(e) => { setDateRange((d) => ({ ...d, end: e.target.value })); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        {(hasFilter || dateRange.start || dateRange.end) && (
          <button
            onClick={() => { setDateRange({ start: '', end: '' }); setSelectedUser(''); setSelectedGroup(''); setPage(1); }}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >清除</button>
        )}
      </div>

      {/* Chat view */}
      <div className="bg-white rounded-xl border border-gray-200 min-h-[400px] max-h-[600px] overflow-y-auto p-4 space-y-3">
        {!hasFilter ? (
          <div className="text-center text-gray-400 py-16">
            <p className="text-3xl mb-2">💬</p>
            <p>請選擇用戶或群組以查看對話紀錄</p>
          </div>
        ) : loading ? (
          <div className="text-center text-gray-400 py-8">載入中...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">無訊息紀錄</div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {hasFilter && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>共 {pagination.total || 0} 則訊息</span>
          {pagination.total > 50 && (
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">上一頁</button>
              <button disabled={page * 50 >= pagination.total} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">下一頁</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isInbound = msg.direction === 'inbound';
  const isGroup = msg.source_type === 'group';

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} gap-2`}>
      {isInbound && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1 ${isGroup ? 'bg-purple-200' : 'bg-gray-200'}`}>
          {msg.display_name?.[0] || '?'}
        </div>
      )}
      <div className="max-w-[70%]">
        {isInbound && (
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            {isGroup && <span className="bg-purple-100 text-purple-700 px-1 rounded text-xs">群組</span>}
            {msg.display_name || msg.line_user_id}
          </p>
        )}
        <div className={`rounded-2xl px-3 py-2 text-sm ${isInbound ? 'bg-gray-100 text-gray-800 rounded-tl-sm' : 'bg-green-500 text-white rounded-tr-sm'}`}>
          {msg.message_type === 'text' ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <p className="text-xs opacity-70">[{msg.message_type}]{msg.media_url ? ' 已儲存' : ''}</p>
          )}
        </div>
        <div className={`flex gap-2 mt-1 text-xs text-gray-400 ${isInbound ? '' : 'justify-end'}`}>
          <span>{dayjs(msg.created_at).format('MM/DD HH:mm')}</span>
          {msg.reply_source && <span className="text-green-600">{msg.reply_source === 'ai' ? 'AI' : '人工'}</span>}
        </div>
      </div>
    </div>
  );
}
