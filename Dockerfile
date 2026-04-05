# ── Stage 1: Build React client ──
FROM node:20-slim AS builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Production runtime ──
FROM node:20-slim

# Playwright 需要的系統套件（Chromium for deliveryPdf）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安裝 server 相依
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# 安裝 Playwright Chromium（deliveryPdf 出貨明細列印需要）
RUN cd server && npx playwright install chromium

# 複製 server 程式碼
COPY server/ ./server/

# 複製建好的 React 靜態檔
COPY --from=builder /app/client/dist ./client/dist

# 建立 uploads 目錄
RUN mkdir -p /app/server/uploads/knowledge /app/server/uploads/media

# 預設環境
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 啟動前先跑 migration，再啟動 server
CMD cd /app/server && npx knex migrate:latest && node src/index.js
