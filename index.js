import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Bareサーバーを /bare/ エンドポイントで作成
const bareServer = createBareServer('/bare/');

// 静的ファイルの配信（publicフォルダ内を表示、Service Worker用のヘッダーを付与）
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    if (!res.headersSent) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
  }
}));

// HTTPリクエストのルーティング（Bareサーバーの通信を優先処理）
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// WebSocketのアップグレード処理
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// ポート設定（Render等の環境変数に対応）
const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Ultraviolet Proxy Server running on port ${port}`);
});
