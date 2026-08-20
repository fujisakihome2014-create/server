import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 外部に頼らず、自前のRenderサーバー上でBareサーバーを起動
const bareServer = createBareServer('/bare/');

// Service Worker が /sw/ 以外でも正常に動くように強力な許可ヘッダを付与
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// バージョンズレ（headers is not iterable）を防ぐため、インストールしたUVのファイルを直接配信
app.use('/uv/', express.static(uvPath));

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// 通常のHTTPリクエストをBareサーバーにルーティング
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  }
});

// ★重要★ WebSocket（リアルタイム通信）をBareサーバーにルーティング（これがないと一部サイトが壊れます）
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.upgrade(req, socket, head);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});
