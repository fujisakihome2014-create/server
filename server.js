const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const URL = require('url').URL;

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('URLが指定されていません。');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(response.status).send(`ターゲットサイトからの応答エラー: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const $ = cheerio.load(html);
      const parsedTarget = new URL(targetUrl);
      const baseOrigin = parsedTarget.origin;
      const basePath = parsedTarget.pathname.substring(0, parsedTarget.pathname.lastIndexOf('/') + 1);

      // 通常のリソース（画像・CSSなど）用パス変換
      const makeAbsolute = (link) => {
        if (!link || link.startsWith('data:') || link.startsWith('blob:') || link.startsWith('javascript:') || link.startsWith('#')) {
          return link;
        }
        try {
          if (link.startsWith('http://') || link.startsWith('https://')) {
            return link;
          }
          if (link.startsWith('/')) {
            return `${baseOrigin}${link}`;
          }
          return new URL(link, baseOrigin + basePath).href;
        } catch (e) {
          return link;
        }
      };

      // src などのアセットは通常の絶対パスへ変換
      $('[src]').each((i, el) => {
        const src = $(el).attr('src');
        $(el).attr('src', makeAbsolute(src));
      });

      $('[action]').each((i, el) => {
        const action = $(el).attr('action');
        $(el).attr('action', makeAbsolute(action));
      });

      // href リンクは「プロキシ経由（/fetch?url=...）」に書き換える
      $('[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }
        const absoluteUrl = makeAbsolute(href);
        // 外部のウェブページ遷移のみプロキシを通す
        if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
          $(el).attr('href', `/fetch?url=${encodeURIComponent(absoluteUrl)}`);
        }
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send($.html());
    } else {
      const buffer = await response.buffer();
      res.setHeader('Content-Type', contentType);
      return res.send(buffer);
    }

  } catch (err) {
    console.error(err);
    res.status(500).send(`プロキシサーバーエラー: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});
