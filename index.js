import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import wisp from 'wisp-server-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// epoxy-transport のパス解決（モジュールエラー対策）
const epoxyPath = path.join(require.resolve('@mercuryworkshop/epoxy-transport/package.json'), '../dist');

const app = express();
const server = http.createServer(app);

// 従来型バックアップ用のBareサーバーを初期化
const bareServer = createBareServer('/bare/');

// Service-Worker-Allowed を設定
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// 静的ファイルの提供
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use(express.static(path.join(__dirname, 'public')));

// 通常のHTTPリクエストをBareサーバーにルーティング（フォールバック用）
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  }
});

// WebSocket（リアルタイム通信）のルーティングをWispとBareで分岐（最強の冗長化）
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    // 高速なWispプロトコルはWispサーバーへ
    wisp.routeRequest(req, socket, head);
  } else if (bareServer.shouldRoute(req)) {
    // 従来のプロトコルはBareサーバーへ
    bareServer.upgrade(req, socket, head);
  } else {
    socket.end();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});
