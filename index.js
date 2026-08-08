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

// publicフォルダを静的ホスティング
app.use(express.static(path.join(__dirname, 'public')));

// ルーティング（Bareサーバーの処理を優先）
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
