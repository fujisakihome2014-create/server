import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// 【修正】http.createServer() に app を渡さず、独立させることで二重送信を防ぐ
const server = http.createServer();
const bareServer = createBareServer('/bare/');

// 静的ファイル（publicフォルダ内の index.html, sw.js, uv系ファイル）を提供
app.use(express.static(path.join(__dirname, 'public')));

// BareサーバーまたはExpressへのリクエスト振り分け
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
