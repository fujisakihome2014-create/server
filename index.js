import express from 'express';
import http from 'http';
import wisp from 'wisp-server-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// epoxy-transport の正しいディレクトリを強制的に取得して解決（エラー対策）
const epoxyPath = path.join(require.resolve('@mercuryworkshop/epoxy-transport/package.json'), '../dist');

const app = express();
const server = http.createServer(app);

// Service-Worker-Allowed を設定
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// 静的ファイルの提供（バージョンズレを防ぐためすべてローカルから配信）
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use(express.static(path.join(__dirname, 'public')));

// 自サーバーのWispサーバーを立ち上げ（WebSocketエラーの根本対策）
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});
