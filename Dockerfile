# ── Stage 1: Build React client ──
FROM node:20-slim AS builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Production runtime ──
FROM node:20-slim

WORKDIR /app

# 安裝 server 相依
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

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
