# 設計文件：/db-query 出貨查詢優化

> 日期：2026-04-09

## 背景

現有 `/db-query` 介面呈現所有可存取的 DB table（含 messages、refresh_tokens、knowledge_chunks 等），選單過多且與出貨查詢無關。使用者主要查詢出貨明細（日期、客戶、商品、數量、金額、成本、毛利、重量），但這些欄位分散在 `shipments` 與 `shipment_items` 兩張 table，無法用視覺篩選一次查詢。AI 查詢的結果也直接展開大量 rows，難以直接取得答案。

## 目標

1. 限制 table 選單只顯示出貨相關 view，移除無關 table
2. 欄位全部中文顯示
3. 進入頁面預設本月篩選
4. AI 查詢結果根據筆數智慧顯示，優先給直接答案

## 不在範圍內

- 新增獨立「出貨查詢」頁面
- 視覺篩選加 JOIN 支援
- 欄位說明 tooltip（未來可加）
- 修改 Admin 設定 UI

---

## 1. DB Migration — `v_shipment_detail` View

新增 migration 檔建立 PostgreSQL view，JOIN `shipments` (s) + `shipment_items` (si)：

```sql
CREATE VIEW v_shipment_detail AS
SELECT
  s.id            AS "出貨單ID",
  s.date          AS "日期",
  s.customer_name AS "客戶名稱",
  s.customer_name_alias AS "客戶別名",
  s.customer_group AS "客戶分組",
  s.vehicle       AS "車次",
  s.status        AS "狀態",
  s.invoice_no    AS "發票號碼",
  si.id           AS "明細ID",
  si.type         AS "類型",
  si.product_name AS "商品名稱",
  si.unit         AS "單位",
  si.qty          AS "數量",
  si.unit_price   AS "單價",
  si.amount       AS "金額",
  si.cost         AS "成本",
  si.gross_profit AS "毛利",
  si.weight_kg    AS "重量kg",
  si.quality_note AS "品質備註"
FROM shipments s
JOIN shipment_items si ON si.shipment_id = s.id;
```

**擴充原則：** 未來加庫存、批次成本、報廢量時，各自建立新 view（`v_inventory_detail`、`v_batch_cost_detail`...），同樣用中文 alias，加到 Admin 允許清單即可。不需改現有 view 或前端邏輯。

**Migration 檔名：** `20260409_01_create_v_shipment_detail.js`

> **技術注意：** View 的中文欄位 alias 在 SQL 中需雙引號（`WHERE "日期" >= ...`）。後端 Knex query builder 在 `where()` 等方法傳入欄位名時，需確認使用 `knex.ref(columnName)` 或 `knex.raw(`"${col}"`)` 正確 quote，否則會語法錯誤。需在實作時驗證 visual filter 的欄位名傳遞方式。

---

## 2. Admin 權限設定（手動操作）

在 db_query_permissions 將相關部門的 `allowed_tables` 更新為：

```json
["v_shipment_detail"]
```

原始 table（shipments、shipment_items、messages 等）從允許清單移除。

> 注意：Admin 帳號不受 allowed_tables 限制，可存取所有 table，行為不變。

---

## 3. 前端 — 預設選中 View + 本月篩選

**觸發條件：** 頁面載入時，若 allowed_tables 包含 `v_shipment_detail`，自動選中該 view。

**預設篩選：** 選中 `v_shipment_detail` 後，自動填入兩條初始篩選：

```
日期 >= YYYY-MM-01（本月第一天）
日期 <= YYYY-MM-last（本月最後一天）
```

使用前端計算當月起訖日期（`new Date()` 取得年月，計算 lastDay）。

**切換規則：** 若使用者切換到其他 view（未來加入），不自動填篩選（避免對不適用 table 插入日期條件）。

**修改檔案：** `client/src/pages/DBQuery/index.jsx`

---

## 4. AI 查詢結果 — 智慧顯示

### 判斷邏輯

| 條件 | 顯示方式 |
|------|---------|
| 結果 = 1 筆，且欄位為數字型別 | 大字卡片（Answer Card） |
| 結果 1–19 筆 | 精簡表格，預設收合，可展開 |
| 結果 ≥ 20 筆 | 只顯示「共 N 筆」＋展開按鈕＋下載 |

### Answer Card（單一數字答案）

```
┌─────────────────────────────┐
│  本月出貨總金額              │
│  $1,234,567                 │  [展開明細]  [⬇ CSV]
└─────────────────────────────┘
```

- 欄位名稱（SQL alias）作為標題
- 數字加千分位格式化
- 若有多個數字欄位（如同時回傳金額+毛利），並排顯示多個卡片

### 少量分組（< 20 筆）

- 預設顯示前 5 筆，剩餘用「▾ 展開」顯示
- 表格右上角有下載按鈕

### 大量明細（≥ 20 筆）

- 只顯示「共 N 筆」＋展開／下載按鈕
- 展開後顯示完整 table（現有 ResultTable 邏輯不變）

**修改檔案：** `client/src/pages/DBQuery/ResultTable.jsx`（新增判斷邏輯）、可抽出 `AnswerCard.jsx` 元件

---

## 5. AI 查詢快速範本（Chip）更新

將現有 5 個通用 chip 換成：

| # | 新 Chip 文字 |
|---|------------|
| 1 | 今天的出貨 |
| 2 | 本月出貨明細 |
| 3 | 查詢特定客戶的出貨 |
| 4 | 毛利最高的前 10 筆商品 |
| 5 | 本月出貨總金額 |

**修改檔案：** `client/src/pages/DBQuery/index.jsx`（chip 陣列）

---

## 驗收條件

1. 進入 /db-query，table 選單只顯示「v_shipment_detail」（出貨明細），無其他原始表
2. 頁面載入後，篩選條件自動填入本月日期範圍
3. 欄位選單顯示中文名稱（日期、客戶名稱、商品名稱 等）
4. AI 問「本月出貨總金額是多少？」→ 顯示 Answer Card，不展開大表格
5. AI 問「本月出貨明細」→ 顯示「共 N 筆」＋展開＋下載，不自動展開
6. AI 快速 chip 更新為出貨情境的 5 個
