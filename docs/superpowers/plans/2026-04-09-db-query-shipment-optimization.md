# /db-query 出貨查詢優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 優化 /db-query 介面，讓出貨查詢更直覺：建立中文欄位 view、預設本月篩選、AI 結果智慧顯示。

**Architecture:** 在 DB 建立 `v_shipment_detail` view JOIN shipments + shipment_items（欄位用中文 alias），後端擴充 table listing 包含 VIEW 類型，前端加入預設篩選與智慧結果顯示邏輯。

**Tech Stack:** PostgreSQL (Knex migrations), Node.js/Express, React + Tailwind CSS

---

## File Map

| 檔案 | 動作 | 說明 |
|------|------|------|
| `server/src/migrations/20260409_20_create_v_shipment_detail.js` | 新增 | 建立 v_shipment_detail view |
| `server/src/services/dbQueryService.js` | 修改 | getAllPublicTables 加入 VIEW 類型 |
| `client/src/pages/DBQuery/index.jsx` | 修改 | 預設選中 v_shipment_detail + 本月篩選 |
| `client/src/pages/DBQuery/LLMQuery.jsx` | 修改 | 更新 CHIPS 為出貨情境 |
| `client/src/pages/DBQuery/ResultTable.jsx` | 修改 | 智慧結果顯示（AnswerCard / 收合）|
| `client/src/pages/DBQuery/AnswerCard.jsx` | 新增 | 單一數字答案卡片元件 |

---

## Task 1: DB Migration — v_shipment_detail View

**Files:**
- Create: `server/src/migrations/20260409_20_create_v_shipment_detail.js`

- [ ] **Step 1: 建立 migration 檔**

```js
// server/src/migrations/20260409_20_create_v_shipment_detail.js
exports.up = async function (knex) {
  await knex.raw(`
    CREATE VIEW v_shipment_detail AS
    SELECT
      s.id              AS "出貨單ID",
      s.date            AS "日期",
      s.customer_name   AS "客戶名稱",
      s.customer_name_alias AS "客戶別名",
      s.customer_group  AS "客戶分組",
      s.vehicle         AS "車次",
      s.status          AS "狀態",
      s.invoice_no      AS "發票號碼",
      si.id             AS "明細ID",
      si.type           AS "類型",
      si.product_name   AS "商品名稱",
      si.unit           AS "單位",
      si.qty            AS "數量",
      si.unit_price     AS "單價",
      si.amount         AS "金額",
      si.cost           AS "成本",
      si.gross_profit   AS "毛利",
      si.weight_kg      AS "重量kg",
      si.quality_note   AS "品質備註"
    FROM shipments s
    JOIN shipment_items si ON si.shipment_id = s.id
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_shipment_detail');
};
```

- [ ] **Step 2: 執行 migration**

```bash
cd server && npm run migrate
```

期望輸出：`Batch N run: 1 migrations`，無 error。

- [ ] **Step 3: 驗證 view 存在並可查詢**

```bash
# 在 server 目錄執行
node -e "
const db = require('./src/config/db');
db.raw('SELECT * FROM v_shipment_detail LIMIT 3')
  .then(r => { console.log('columns:', Object.keys(r.rows[0] || {})); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
"
```

期望輸出：`columns: ['出貨單ID', '日期', '客戶名稱', ...]`（含中文欄位名）。

- [ ] **Step 4: Commit**

```bash
cd server && git add src/migrations/20260409_20_create_v_shipment_detail.js
git commit -m "feat(db): 建立 v_shipment_detail view（出貨明細中文欄位）"
```

---

## Task 2: 後端 — 將 VIEW 加入 table 清單

**Files:**
- Modify: `server/src/services/dbQueryService.js:24-31`

目前 `getAllPublicTables()` 只查 `table_type: 'BASE TABLE'`，VIEW 不會出現。需同時包含 `VIEW` 類型。

- [ ] **Step 1: 修改 getAllPublicTables**

在 `server/src/services/dbQueryService.js` 找到 `getAllPublicTables()` 函式（約第 24 行），將：

```js
async function getAllPublicTables() {
  const rows = await db('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public', table_type: 'BASE TABLE' })
    .whereNotIn('table_name', SYSTEM_TABLES)
    .orderBy('table_name');
  return rows.map((r) => r.table_name);
}
```

改為：

```js
async function getAllPublicTables() {
  const rows = await db('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public' })
    .whereIn('table_type', ['BASE TABLE', 'VIEW'])
    .whereNotIn('table_name', SYSTEM_TABLES)
    .orderBy('table_name');
  return rows.map((r) => r.table_name);
}
```

- [ ] **Step 2: 驗證 schema endpoint 回傳中文欄位**

啟動 server（`cd server && npm run dev`），然後在另一個 terminal：

```bash
curl -s http://localhost:3000/api/db-query/schema/v_shipment_detail \
  -H "Authorization: Bearer <admin_token>" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log(d.columns.map(c=>c.column_name));
"
```

期望輸出：`['出貨單ID', '日期', '客戶名稱', '客戶別名', ...]`

> **注意**：若無法用 curl 取得 token，改為在瀏覽器 /db-query 頁面開 DevTools → Network，觀察 `/api/db-query/schema/v_shipment_detail` 回應。

- [ ] **Step 3: Commit**

```bash
git add server/src/services/dbQueryService.js
git commit -m "fix(db-query): getAllPublicTables 加入 VIEW 類型"
```

---

## Task 3: 後端 — 驗證中文欄位名稱在 Knex WHERE 的正確性

**Files:**
- Modify: `server/src/services/dbQueryService.js:166-217`（executeVisualQuery）

Knex PostgreSQL dialect 預設會將欄位名包在雙引號（`"日期"`），但需實際驗證。若不正確，需手動 quote。

- [ ] **Step 1: 驗證 Knex 產生的 SQL**

```bash
node -e "
const db = require('./src/config/db');
const q = db('v_shipment_detail').select('*').where('日期', '>=', '2026-04-01');
console.log(q.toSQL().sql);
process.exit(0);
"
```

期望輸出中應包含 `\"日期\"` 或 `"日期"`，例如：
`select * from "v_shipment_detail" where "日期" >= ?`

- [ ] **Step 2a: 若 SQL 已正確 quote（含雙引號）→ 不需修改，僅 commit 驗證記錄**

無需改 code，繼續 Task 4。

- [ ] **Step 2b: 若 SQL 未 quote（`where 日期 >= ?`）→ 修改 executeVisualQuery**

在 `executeVisualQuery` 函式中，將所有使用 `f.column` 作為欄位識別符的地方，改用 `db.ref(f.column)`。

找到以下 switch 區塊（約第 170–202 行）：

```js
switch (f.operator) {
  case '=':
    query = query.where(f.column, f.value);
    break;
  case '!=':
    query = query.whereNot(f.column, f.value);
    break;
  case '>':
    query = query.where(f.column, '>', f.value);
    break;
  case '>=':
    query = query.where(f.column, '>=', f.value);
    break;
  case '<':
    query = query.where(f.column, '<', f.value);
    break;
  case '<=':
    query = query.where(f.column, '<=', f.value);
    break;
  case 'contains':
    query = query.whereILike(f.column, `%${f.value}%`);
    break;
  case 'starts_with':
    query = query.whereILike(f.column, `${f.value}%`);
    break;
  case 'is_null':
    query = query.whereNull(f.column);
    break;
  case 'is_not_null':
    query = query.whereNotNull(f.column);
    break;
}
```

改為（使用 `db.ref()` 確保正確 quote）：

```js
const col = db.ref(f.column);
switch (f.operator) {
  case '=':
    query = query.where(col, f.value);
    break;
  case '!=':
    query = query.whereNot(col, f.value);
    break;
  case '>':
    query = query.where(col, '>', f.value);
    break;
  case '>=':
    query = query.where(col, '>=', f.value);
    break;
  case '<':
    query = query.where(col, '<', f.value);
    break;
  case '<=':
    query = query.where(col, '<=', f.value);
    break;
  case 'contains':
    query = query.whereILike(col, `%${f.value}%`);
    break;
  case 'starts_with':
    query = query.whereILike(col, `${f.value}%`);
    break;
  case 'is_null':
    query = query.whereNull(col);
    break;
  case 'is_not_null':
    query = query.whereNotNull(col);
    break;
}
```

同樣更新 `sortBy`（約第 205 行）：

```js
// 原本
if (sortBy) query = query.orderBy(sortBy, sortDir || 'desc');
// 改為
if (sortBy) query = query.orderBy(db.ref(sortBy), sortDir || 'desc');
```

- [ ] **Step 3: 再次驗證**

```bash
node -e "
const db = require('./src/config/db');
const q = db('v_shipment_detail').select('*').where(db.ref('日期'), '>=', '2026-04-01');
console.log(q.toSQL().sql);
process.exit(0);
"
```

期望：`select * from "v_shipment_detail" where "日期" >= ?`

- [ ] **Step 4: Commit（若有改動）**

```bash
git add server/src/services/dbQueryService.js
git commit -m "fix(db-query): 中文欄位名稱使用 db.ref() 確保正確 quote"
```

---

## Task 4: 前端 — 預設選中 v_shipment_detail + 本月篩選

**Files:**
- Modify: `client/src/pages/DBQuery/index.jsx`

在 `fetchSchema` 函式中，當 table 為 `v_shipment_detail` 時，將預設篩選條件改為本月日期範圍，而非第一欄的空白篩選。

- [ ] **Step 1: 在 index.jsx 頂部新增 helper 函式**

在 `export default function DBQuery()` 前（import 區塊之後）加入：

```js
function getThisMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstDay = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { firstDay, lastDay };
}
```

- [ ] **Step 2: 修改 fetchSchema 加入條件分支**

找到 `fetchSchema` 函式（約第 61 行）：

```js
const fetchSchema = async (table) => {
  try {
    const res = await api.get(`/db-query/schema/${table}`);
    const cols = res.data.columns;
    setSchema(cols);
    // Default: first filter row with first column
    if (cols.length) {
      setFilters([{ column: cols[0].column_name, operator: 'contains', value: '' }]);
    } else {
      setFilters([]);
    }
    setSortBy('');
    setResult(null);
  } catch {
    setSchema([]);
  }
};
```

改為：

```js
const fetchSchema = async (table) => {
  try {
    const res = await api.get(`/db-query/schema/${table}`);
    const cols = res.data.columns;
    setSchema(cols);
    if (table === 'v_shipment_detail') {
      const { firstDay, lastDay } = getThisMonthRange();
      setFilters([
        { column: '日期', operator: '>=', value: firstDay },
        { column: '日期', operator: '<=', value: lastDay },
      ]);
    } else if (cols.length) {
      setFilters([{ column: cols[0].column_name, operator: 'contains', value: '' }]);
    } else {
      setFilters([]);
    }
    setSortBy('');
    setResult(null);
  } catch {
    setSchema([]);
  }
};
```

- [ ] **Step 3: 驗證（瀏覽器）**

啟動前端（`cd client && npm run dev`），開啟 http://localhost:5173。

進入資料查詢頁面，確認：
1. table 選單自動選中「v_shipment_detail」（或顯示為此 view）
2. 篩選條件已預填「日期 >= 本月第一天」和「日期 <= 本月最後一天」
3. 欄位選單顯示中文名稱（日期、客戶名稱、商品名稱…）

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/DBQuery/index.jsx
git commit -m "feat(db-query): v_shipment_detail 預設選中 + 本月日期篩選"
```

---

## Task 5: 前端 — 更新 AI 查詢 Chip 文字

**Files:**
- Modify: `client/src/pages/DBQuery/LLMQuery.jsx:3-9`

- [ ] **Step 1: 修改 CHIPS 陣列**

找到 `LLMQuery.jsx` 頂部的 CHIPS 陣列：

```js
const CHIPS = [
  '查詢所有資料',
  '上個月的記錄',
  '狀態為已完成的資料',
  '最近 30 天的資料',
  '數量最多的前 10 筆',
];
```

改為：

```js
const CHIPS = [
  '今天的出貨',
  '本月出貨明細',
  '查詢特定客戶的出貨',
  '毛利最高的前 10 筆商品',
  '本月出貨總金額',
];
```

- [ ] **Step 2: 驗證（瀏覽器）**

在 /db-query 切換到「AI 自然語言」tab，確認 chip 顯示為新的 5 個文字。

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/DBQuery/LLMQuery.jsx
git commit -m "feat(db-query): AI 查詢 chip 更新為出貨情境"
```

---

## Task 6: 前端 — AI 結果智慧顯示（AnswerCard + 收合邏輯）

**Files:**
- Create: `client/src/pages/DBQuery/AnswerCard.jsx`
- Modify: `client/src/pages/DBQuery/ResultTable.jsx`

### 6a: 建立 AnswerCard 元件

- [ ] **Step 1: 建立 AnswerCard.jsx**

```jsx
// client/src/pages/DBQuery/AnswerCard.jsx
import React from 'react';

function formatNumber(value) {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

export default function AnswerCard({ row, onExpand, onExport }) {
  const entries = Object.entries(row).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex gap-4 flex-wrap flex-1">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex-1 min-w-40 bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-center"
            >
              <div className="text-xs text-gray-500 mb-1">{key}</div>
              <div className="text-2xl font-bold text-green-700">
                {formatNumber(value)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onExpand}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            展開明細
          </button>
          <button
            onClick={() => onExport('csv')}
            className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => onExport('xlsx')}
            className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            ⬇ XLSX
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 6b: 修改 ResultTable 加入智慧顯示邏輯

- [ ] **Step 2: 在 ResultTable.jsx 頂部加入 import 和 helper**

將第 1 行的 import 改為（加入 `useEffect`）：

```js
import React, { useState, useMemo, useEffect } from 'react';
```

加入 AnswerCard import：

```js
import AnswerCard from './AnswerCard';
```

在 `const PAGE_SIZE = 20;` 後加入：

```js
function detectDisplayMode(rows, total_count, queryMode) {
  if (queryMode !== 'llm') return 'table';
  if (!rows.length) return 'table';
  if (rows.length === 1) {
    const values = Object.values(rows[0]).filter((v) => v !== null && v !== undefined);
    const allNumeric = values.length > 0 && values.every((v) => !isNaN(Number(v)));
    if (allNumeric) return 'answer-card';
  }
  if (rows.length < 20) return 'compact';
  return 'large';
}
```

- [ ] **Step 3: 在 ResultTable component 內加入 expanded state 和 display mode**

在 `ResultTable` 函式內現有的 useState 後面加入：

```js
const [expanded, setExpanded] = useState(false);
const displayMode = detectDisplayMode(rows, total_count, queryMode);
```

- [ ] **Step 4: 在 ResultTable return 中加入條件渲染**

找到 `return (` 後的第一個 `<div className="bg-white rounded-xl...">` 開始的 JSX。

在現有 JSX 的最前面（`{/* Header */}` 之前）加入條件：

```jsx
{/* Answer Card mode — 1 numeric row */}
{displayMode === 'answer-card' && !expanded && (
  <AnswerCard
    row={rows[0]}
    onExpand={() => setExpanded(true)}
    onExport={handleExport}
  />
)}

{/* Large result mode — ≥ 20 rows, collapsed by default */}
{displayMode === 'large' && !expanded && (
  <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
    <span className="text-sm text-gray-600">
      共 <strong className="text-gray-800">{total_count.toLocaleString()}</strong> 筆
    </span>
    <div className="flex items-center gap-2">
      <button
        onClick={() => setExpanded(true)}
        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
      >
        ▾ 展開表格
      </button>
      <button
        onClick={() => handleExport('csv')}
        disabled={exporting}
        className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        ⬇ CSV
      </button>
      <button
        onClick={() => handleExport('xlsx')}
        disabled={exporting}
        className="px-3 py-1.5 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        ⬇ XLSX
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: 包裝主表格 — 只在需要時顯示**

找到 `ResultTable.jsx` 中的 `return (` 後最外層 `<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">` 容器（約第 62 行）。

將整個主表格容器（從 `<div className="bg-white rounded-xl...">` 到對應的 `</div>`）包在條件裡：

```jsx
{(displayMode === 'table' || displayMode === 'compact' || expanded) && (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    {/* 現有的所有 Header / SQL / Table / Pagination JSX 保持不動 */}
  </div>
)}
```

這樣 answer-card 模式和 large 模式在 `expanded` 為 false 時，不渲染主表格 div。

**Compact mode 額外處理**（< 20 rows）：

找到 ResultTable 現有的 `{/* Pagination */}` 區塊上方的 `<tbody>` 區塊。

在 `pageRows.map(...)` 那行，將整個 `<tbody>` 內容替換為：

```jsx
<tbody>
  {(displayMode === 'compact' && !expanded
    ? pageRows.slice(0, 5)
    : pageRows
  ).map((row, i) => (
    <tr key={i} className="border-b border-gray-50 hover:bg-green-50/30 transition-colors">
      {displayColumns.map((col) => (
        <td key={col} className="px-4 py-2.5 text-xs text-gray-700 max-w-xs truncate">
          {formatCell(row[col])}
        </td>
      ))}
    </tr>
  ))}
  {displayMode === 'compact' && !expanded && rows.length > 5 && (
    <tr>
      <td
        colSpan={displayColumns.length}
        className="px-4 py-2.5 text-center"
      >
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-green-600 hover:underline"
        >
          ▾ 展開全部 {rows.length} 筆
        </button>
      </td>
    </tr>
  )}
</tbody>
```

- [ ] **Step 6: 重置 expanded 當 result 改變**

在 ResultTable 的 `useEffect` 或在 `useMemo` 計算 `displayMode` 之前，加入 reset。

在 ResultTable 函式內，在現有的 useState 定義後加入：

```js
useEffect(() => {
  setExpanded(false);
}, [rows]);
```

- [ ] **Step 7: 驗證（瀏覽器）**

在 AI 查詢 tab 輸入「本月出貨總金額」，確認：
1. 回傳 1 筆數字時 → 顯示 AnswerCard（大字卡片），不展開表格
2. 點「展開明細」→ 顯示完整 ResultTable
3. 輸入「本月出貨明細」→ 顯示「共 N 筆」＋展開＋下載按鈕
4. 點「展開表格」→ 顯示完整 ResultTable

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/DBQuery/AnswerCard.jsx client/src/pages/DBQuery/ResultTable.jsx
git commit -m "feat(db-query): AI 結果智慧顯示（AnswerCard + 大量筆數收合）"
```

---

## Task 7: Admin — 更新部門查詢權限（手動）

這是設定步驟，不需寫 code。

- [ ] **Step 1: 以 Admin 帳號登入 portal**

開啟 /db-query → 右上角「⚙️ 管理設定」。

- [ ] **Step 2: 找到目標部門，編輯允許的 table**

將 `allowed_tables` 設定為只勾選 `v_shipment_detail`，移除 shipments、shipment_items 等原始表。

- [ ] **Step 3: 儲存並確認**

重新整理頁面，確認一般帳號的 table 選單只顯示「v_shipment_detail」。

---

## 驗收清單

對照 spec 的 6 條驗收條件：

- [ ] AC1: 進入 /db-query，table 選單只顯示「v_shipment_detail」，無其他原始表
- [ ] AC2: 頁面載入後，篩選條件自動填入本月日期範圍
- [ ] AC3: 欄位選單顯示中文名稱（日期、客戶名稱、商品名稱 等）
- [ ] AC4: AI 問「本月出貨總金額是多少？」→ 顯示 AnswerCard，不展開大表格
- [ ] AC5: AI 問「本月出貨明細」→ 顯示「共 N 筆」＋展開＋下載，不自動展開
- [ ] AC6: AI 快速 chip 更新為出貨情境的 5 個
