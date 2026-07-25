const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ペイロードをデコードしてサーバーベースとターゲットURLを復元する関数 */
function decodeSecureTunnelPayload(encodedStr) {
  try {
    let b1 = Buffer.from(encodedStr, 'base64').toString('utf8');
    let b2 = Buffer.from(b1, 'base64').toString('utf8');
    let scrambled = Buffer.from(b2, 'base64').toString('utf8');

    const secretKey = 0xA5;
    let decodedCombined = '';
    for (let i = 0; i < scrambled.length; i++) {
      decodedCombined += String.fromCharCode(scrambled.charCodeAt(i) ^ secretKey);
    }

    // デバッグ用：何が復元されたかログに出力
    console.log("Decoded Combined String:", decodedCombined);

    const parts = decodedCombined.split('|');
    if (parts.length >= 2) {
      return {
        serverBase: parts[0],
        targetUrl: parts.slice(1).join('|')
      };
    }
    return { serverBase: null, targetUrl: decodedCombined };
  } catch (e) {
    console.error("Payload decoding error:", e);
    return null;
  }
}

/* セキュアトンネルのエンドポイント */
app.all('/secure-tunnel/:payload', async (req, res) => {
  const encodedPayload = req.params.payload;
  const decodedData = decodeSecureTunnelPayload(encodedPayload);

  if (!decodedData || !decodedData.targetUrl) {
    console.error("Failed to decode payload or missing targetUrl");
    return res.status(400).send('Invalid or corrupted tunnel payload.');
  }

  const targetUrl = decodedData.targetUrl.trim();
  console.log("Resolved Target URL:", targetUrl);

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    console.error("URL format error. Does not start with http:// or https:// ->", targetUrl);
    return res.status(400).send('Invalid target URL format.');
  }

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'] || 'text/html';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf8');
      const $ = cheerio.load(html);
      return res.send($.html());
    }

    return res.send(response.data);

  } catch (error) {
    console.error("Proxy tunnel error:", error.message);
    res.status(500).send('Failed to fetch the target URL through the secure tunnel.');
  }
});

app.listen(PORT, () => {
  console.log(`Secure Tunnel Proxy Server running on port ${PORT}`);
});
