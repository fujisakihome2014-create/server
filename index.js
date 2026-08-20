import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport'; // 追加

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const bareServer = createBareServer('/bare/');

// sw.js を配信する際に Service-Worker-Allowed ヘッダを明示的に付与
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/sw/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));
app.use('/epoxy/', express.static(epoxyPath)); // 追加

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
