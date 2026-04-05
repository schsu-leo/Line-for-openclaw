# LINE 智能客服 — 災難復原計劃

> 情境：Oracle VM 完全無法恢復，line_cs 資料庫需從零重建
> 建立日期：2026-04-05

## 各資料表損失分類

| 資料表 | 分類 | 說明 |
|---|---|---|
| `users` | CAN REBUILD | migration 重建 schema，需手動建立第一位管理員 |
| `system_settings` | CAN RE-ENTER | 預設值由 migration seed 填入，API Key / LINE 憑證需重新輸入 |
| `schedule_rules` | CAN RE-ENTER | 排程規則需手動重設 |
| `broadcast_lists` | CAN RE-ENTER | 群發名單需手動重建 |
| `line_users` | **WILL LOSE** | 用戶重新傳訊時自動重建基本資料，但 note/mode 設定不可恢復 |
| `messages` | **WILL LOSE** | 所有歷史訊息永久遺失 |
| `message_reports` | **WILL LOSE** | 訊息分析報告永久遺失 |
| `uploaded_files` + `knowledge_chunks` | **WILL LOSE** | 知識庫需重新上傳原始文件 |
| `line_groups` | **WILL LOSE** | 群組有新訊息時自動重建，但 note/is_active 不可恢復 |

## 損失摘要

| 分類 | 數量 | 說明 |
|---|---|---|
| CAN REBUILD | 2 | schema + 預設值自動重建 |
| CAN RE-ENTER | 3 | API Key、排程、群發名單需手動補回 |
| **WILL LOSE** | **5** | 用戶、訊息、報告、知識庫、群組紀錄 |

## 復原 SOP

### Step 1：執行 Migration
```bash
cd LINE智能客服/server
npx knex migrate:latest
```

### Step 2：建立管理員帳號
啟動 server 後透過 `/api/setup` 初始設定頁面建立。

### Step 3：透過管理後台重新設定
| 設定項 | 來源 |
|---|---|
| `llm_api_key` | Anthropic / OpenAI Dashboard |
| `line_channel_secret` | LINE Developers Console |
| `line_channel_access_token` | LINE Developers Console |
| `google_file_search_api_key` | Google AI Studio |
| `system_prompt` | 預設值已填入，可修改 |

### Step 4：重建排程規則
Admin UI → Schedules 頁面設定 AI 回覆時段。

### Step 5：重新上傳知識庫
Admin UI → Knowledge 頁面上傳原始文件。

### Step 6：重建群發名單
Admin UI → Broadcast 頁面建立。

## 加密注意事項

- 舊 DB 已遺失 → 舊 `ENCRYPTION_KEY` 無意義，**生成全新金鑰**
- 新 `JWT_SECRET` 也需重新生成，舊 token 全部失效
- settings.service.js 有 env fallback：DB 值為空時讀 `.env` 中的 LINE/Google credentials

## 未來預防措施

1. **每日 pg_dump** 排程，存至 Google Drive
2. **ENCRYPTION_KEY** 與 DB 備份分開保管
3. **定期匯出** line_users CSV 備查
4. **訊息歸檔** 考慮定期匯出至 Google Sheets
