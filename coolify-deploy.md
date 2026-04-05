# Coolify 部署指南 — LINE 智能客服 + 出貨明細列印

## 前置條件
1. Hetzner CX42 (8 vCPU / 16 GB) 已開通
2. Coolify 已安裝（`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`）
3. Domain `admin.shang-ren.com` DNS A record 指向 Hetzner IP

## 部署步驟

### 1. 上傳 Credentials

SSH 到 Hetzner server，建立 credentials 目錄：

```bash
mkdir -p /data/coolify/credentials
```

從本機上傳（替換 HETZNER_IP）：

```bash
# Google Service Account
scp ~/.claude/sr-product-catalog-restructure-48bef5a7094a.json \
    root@HETZNER_IP:/data/coolify/credentials/google-sa.json

# Drive OAuth Token
scp gas-monthly-invoice/drive_token.json \
    root@HETZNER_IP:/data/coolify/credentials/drive_token.json
```

### 2. Coolify 設定

在 Coolify Dashboard 中：

#### 新增 Project → 新增 Resource → Docker Compose

貼入 `docker-compose.yml` 的內容，並設定以下環境變數：

#### 環境變數（在 Coolify Environment Variables 頁面設定）

```env
# ── 必填 ──
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD@db:5432/line_cs
JWT_SECRET=（用 node -e "console.log(require('crypto').randomBytes(48).toString('base64'))" 產生）
ENCRYPTION_KEY=（用 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 產生）

# ── PostgreSQL ──
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
POSTGRES_DB=line_cs

# ── Google Credentials ──
GOOGLE_SA_KEY_PATH=/app/credentials/google-sa.json
DRIVE_TOKEN_PATH=/app/credentials/drive_token.json

# ── CORS ──
CORS_ALLOWED_ORIGINS=*.shang-ren.com

# ── LINE（Fallback，優先從管理後台設定）──
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token

# ── Google AI（Fallback）──
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

#### Domain 設定
- Domain: `admin.shang-ren.com`
- SSL: Let's Encrypt（Coolify 自動處理）
- Port: 3000

#### Volume Mounts
Coolify 會自動處理 docker-compose 的 named volumes。
額外需要 bind mount credentials：

```yaml
# 在 Coolify 的 docker-compose override 中加入
volumes:
  - /data/coolify/credentials/google-sa.json:/app/credentials/google-sa.json:ro
  - /data/coolify/credentials/drive_token.json:/app/credentials/drive_token.json:ro
```

### 3. 部署後驗證

```bash
# Health check
curl https://admin.shang-ren.com/health

# 測試 API
curl https://admin.shang-ren.com/api/delivery-pdf/options?spreadsheetId=1Am0Aobazouit64Zf6_gN-s2DNZoYRHod3KfMLF5AVP8
```

### 4. LINE Console 更新

1. 到 LINE Developers Console
2. Messaging API → Webhook URL
3. 改為 `https://admin.shang-ren.com/api/webhook/line`
4. 點 Verify 確認

### 5. 如果從 Oracle 還原資料

```bash
# 在 Hetzner 上
docker compose exec db psql -U postgres line_cs < line_cs_backup.sql
```

## 常用維護指令

```bash
# 查看 logs
docker compose logs -f app

# 重新部署
# 在 Coolify Dashboard 點 Redeploy

# 手動跑 migration
docker compose exec app sh -c "cd /app/server && npx knex migrate:latest"

# DB backup
docker compose exec db pg_dump -U postgres line_cs > backup_$(date +%Y%m%d).sql
```
