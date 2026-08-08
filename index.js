import express from "express";
import { createServer } from "node:http";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { wisp } from "wisp-server-node";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const app = express();

// publicフォルダを静的配信
app.use(express.static(join(__dirname, "public")));
// UVのクライアントファイルを配信
app.use("/uv/", express.static(uvPath));

const server = createServer();
server.on("request", (req, res) => {
    app(req, res);
});

server.on("upgrade", (req, socket, head) => {
    if (req.url.endsWith("/wisp/")) {
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
