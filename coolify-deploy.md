# Coolify 部署指南 — 尚仁 Portal (app.shang-ren.com)

> 更新：2026-04-06 — 6 services 架構（LINE CS + Invoice + Delivery PDF + Attendance + Attendance Client + DB）

## 前置條件

1. Contabo VPS 30 Tokyo (`155.133.7.29`) 已開通
2. SSH root access 已設定
3. Domain `app.shang-ren.com` + `admin.shang-ren.com` DNS 可控

---

## Step 1: 安裝 Coolify

```bash
ssh root@155.133.7.29

curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

安裝完成後瀏覽 `http://155.133.7.29:8000` 設定 admin 帳號。

---

## Step 2: 上傳 Credentials

```bash
# 在 VPS 上建立目錄
ssh root@155.133.7.29 "mkdir -p /data/coolify/credentials"
```

從本機上傳（在 ShangRen_Automation/ 目錄下執行）：

```bash
# Google Service Account
scp ~/.claude/sr-product-catalog-restructure-48bef5a7094a.json \
    root@155.133.7.29:/data/coolify/credentials/google-sa.json

# Drive OAuth Token
scp gas-monthly-invoice/drive_token.json \
    root@155.133.7.29:/data/coolify/credentials/drive_token.json
```

---

## Step 3: Clone Repo 到 VPS

```bash
ssh root@155.133.7.29

cd /opt
git clone https://github.com/schsu-leo/ShangRen_Automation.git
cd ShangRen_Automation
```

> 注意：LINE智能客服 是 gitlink，需要在 VPS 上也 clone 它的 repo 到同層目錄，或改用完整複製。

---

## Step 4: 準備 .env 檔案

### LINE智能客服 server/.env

```bash
cat > LINE智能客服/server/.env << 'ENVEOF'
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD@db:5432/line_cs
JWT_SECRET=（執行 node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"）
ENCRYPTION_KEY=（執行 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"）
PORTAL_JWT_SECRET=（執行 node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"）
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
GOOGLE_AI_API_KEY=your-google-ai-api-key
GOOGLE_SA_KEY_PATH=/app/credentials/google-sa.json
DRIVE_TOKEN_PATH=/app/credentials/drive_token.json
CORS_ALLOWED_ORIGINS=*.shang-ren.com
ENVEOF
```

### gas-monthly-invoice/.env

```bash
# 從本機複製已有的 .env
scp gas-monthly-invoice/.env root@155.133.7.29:/opt/ShangRen_Automation/gas-monthly-invoice/.env
```

### Docker Compose 環境變數

```bash
cat > LINE智能客服/.env << 'ENVEOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
POSTGRES_DB=line_cs
GOOGLE_SA_KEY_PATH=/data/coolify/credentials/google-sa.json
DRIVE_TOKEN_PATH=/data/coolify/credentials/drive_token.json
PORTAL_JWT_SECRET=（與 server/.env 相同值）
ATT_JWT_SECRET=（執行 node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"）
ENVEOF
```

> **重要：`PORTAL_JWT_SECRET` 必須在 LINE CS server/.env 和 docker-compose .env 中一致！**

---

## Step 5: 建立 Coolify external network + 啟動

```bash
# 建立 Coolify 的 external network（如果 Coolify 還沒建）
docker network create coolify 2>/dev/null || true

# 啟動所有服務
cd /opt/ShangRen_Automation/LINE智能客服
docker compose up -d --build
```

首次啟動會：
- 建立 `line_cs` DB（PostgreSQL default）
- 執行 `init-db/create-databases.sh` 建立 `attendance` DB
- LINE CS 自動跑 `knex migrate:latest`
- Attendance 自動跑 `prisma migrate deploy`

---

## Step 6: DNS 設定

在 Namecheap 設定：

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | app | 155.133.7.29 | Auto |
| A | admin | 155.133.7.29 | Auto |

> `admin.shang-ren.com` 會被 Traefik 301 redirect 到 `app.shang-ren.com`

---

## Step 7: 部署後驗證

```bash
# Health checks
curl https://app.shang-ren.com/health                    # LINE CS
curl https://app.shang-ren.com/api/delivery-pdf/options   # Delivery PDF
curl https://app.shang-ren.com/api/att/health             # Attendance (如有 health endpoint)
curl https://app.shang-ren.com/api/inv/health             # Invoice (如有 health endpoint)

# 前端
curl -I https://app.shang-ren.com/                        # Portal SPA
curl -I https://app.shang-ren.com/attendance/dashboard     # Attendance UI

# Legacy redirect
curl -I https://admin.shang-ren.com/                       # 應回 301 → app.shang-ren.com
```

---

## Step 8: LINE Console 更新

1. **LINE Developers Console → Messaging API**
   - Webhook URL: `https://app.shang-ren.com/api/webhook/line`
   - 點 Verify

2. **LINE Developers Console → LIFF**
   - Attendance LIFF Endpoint URL: `https://app.shang-ren.com/attendance/liff`
   - Channel ID: `2009558598`

---

## Step 9: GAS delivery panel 更新

Code.gs 已改指 `app.shang-ren.com`，需 clasp push：

```bash
# 在本機
cd GAS_delivery_panel
clasp pull          # 先拉遠端
clasp push          # 推上去（不用 --force）
```

---

## Step 10: Oracle DB 還原（如需要）

```bash
# 在 Oracle VM 匯出（如果還活著）
ssh ubuntu@161.33.202.249 "pg_dump -U postgres line_cs" > line_cs_backup.sql

# 上傳到 Contabo
scp line_cs_backup.sql root@155.133.7.29:/tmp/

# 匯入
ssh root@155.133.7.29
cd /opt/ShangRen_Automation/LINE智能客服
docker compose exec -T db psql -U postgres line_cs < /tmp/line_cs_backup.sql
```

---

## 常用維護指令

```bash
cd /opt/ShangRen_Automation/LINE智能客服

# 查看所有服務狀態
docker compose ps

# 查看 logs
docker compose logs -f app           # LINE CS
docker compose logs -f delivery      # Delivery PDF
docker compose logs -f attendance    # Attendance API
docker compose logs -f att-client    # Attendance Frontend
docker compose logs -f invoice       # Invoice

# 重新部署某個服務
docker compose up -d --build app

# DB backup
docker compose exec db pg_dump -U postgres line_cs > backup_linecs_$(date +%Y%m%d).sql
docker compose exec db pg_dump -U postgres attendance > backup_attendance_$(date +%Y%m%d).sql

# 手動跑 migration
docker compose exec app sh -c "cd /app/server && npx knex migrate:latest"
docker compose exec attendance sh -c "npx prisma migrate deploy"
```

---

## 架構圖

```
                    ┌─────────────────────────────┐
                    │      Traefik (Coolify)       │
                    │     app.shang-ren.com:443    │
                    └────────────┬────────────────-┘
                                 │
        ┌──────────┬─────────────┼──────────────┬──────────────┐
        │          │             │              │              │
  /api/auth    /api/cs     /api/inv      /api/att       /attendance
  /api/webhook /api/setup  (strip→/)     (strip→/api)   (static)
  /api/delivery-pdf         │              │              │
        │          │        │              │              │
   ┌────┴────┐  ┌──┴──┐ ┌──┴───┐  ┌──────┴──────┐  ┌───┴────┐
   │   app   │  │ app │ │invoice│  │ attendance  │  │att-cli-│
   │  :3000  │  │:3000│ │ :8080 │  │   :3001     │  │ent :80 │
   └────┬────┘  └──┬──┘ └──────┘  └──────┬──────┘  └────────┘
        │          │                      │
   ┌────┴──────────┴──────────────────────┴────┐
   │              PostgreSQL :5432              │
   │         line_cs  │  attendance             │
   └───────────────────────────────────────────┘
```
