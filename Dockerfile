# 浮遊トランプ神経衰弱：ゲームサーバー（画面の配信＋オンライン対戦）
# Render・手元の Docker のどちらでも、このファイル1つで動く。

FROM node:22-alpine

# 本番として動かす
ENV NODE_ENV=production
WORKDIR /app

# 先に依存パッケージだけを入れる（ソースだけ変えたときに、ここを再利用できる）
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

# 配信する画面とサーバーのコード
COPY index.html ./
COPY css ./css
COPY src ./src
COPY server ./server

# root ではない利用者で動かす（安全のため）
USER node

# Render は PORT を自動で設定する。手元では 8080
ENV PORT=8080
EXPOSE 8080

# コンテナの死活確認（/health が 200 を返すか）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "server/index.js"]
