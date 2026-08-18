import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const bareServer = createBareServer('/bare/');

// 静的ファイルの提供（publicフォルダ内の index.html, uv.bundle.js, uv.config.js, sw.js など）
app.use(express.static(path.join(__dirname, 'public')));

// ★重要：/sw/ 以下のリクエストをすべて public/index.html に転送するルーティング
app.get('/sw/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Bareサーバーのリクエスト処理
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  } else {
    app(req, res);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
