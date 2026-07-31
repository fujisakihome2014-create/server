const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const URL = require('url').URL;

const app = express();
const PORT = process.env.PORT || 3000;

// 1. メインのHTML取得・パス書き換えエンドポイント
app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URLが指定されていません。');

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(response.status).send(`ターゲットサイトエラー: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      let html = await response.text();
      const $ = cheerio.load(html);
      const parsedTarget = new URL(targetUrl);
      const baseOrigin = parsedTarget.origin;
      const basePath = parsedTarget.pathname.substring(0, parsedTarget.pathname.lastIndexOf('/') + 1);

      // 絶対パスに変換するヘルパー
      const makeAbsolute = (link) => {
        if (!link || link.startsWith('data:') || link.startsWith('blob:') || link.startsWith('javascript:') || link.startsWith('#')) {
          return link;
        }
        try {
          if (link.startsWith('http://') || link.startsWith('https://')) return link;
          if (link.startsWith('/')) return `${baseOrigin}${link}`;
          return new URL(link, baseOrigin + basePath).href;
        } catch (e) {
          return link;
        }
      };

      // 画像やCSSなどのアセットは、Renderの /proxy-asset 経由に書き換える
      const wrapProxy = (link) => {
        const abs = makeAbsolute(link);
        if (!abs || abs.startsWith('data:') || abs.startsWith('javascript:')) return abs;
        return `/proxy-asset?url=${encodeURIComponent(abs)}`;
      };

      // src (画像・スクリプト等) を中継経由に変換
      $('[src]').each((i, el) => {
        $(el).attr('src', wrapProxy($(el).attr('src')));
      });

      // style属性内の background-image などの url() も必要に応じてケアしつつ、link要素のCSSはラップ
      $('link[rel="stylesheet"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href) $(el).attr('href', wrapProxy(href));
      });

      // <a> などのリンクは、再び Render の /fetch 経由（iframe内遷移）に変換
      $('[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        const abs = makeAbsolute(href);
        if (abs.startsWith('http://') || abs.startsWith('https://')) {
          $(el).attr('href', `/fetch?url=${encodeURIComponent(abs)}`);
        }
      });

      // フォームの送信先もプロキシ経由にする
      $('[action]').each((i, el) => {
        const action = $(el).attr('action');
        if (action) {
          const abs = makeAbsolute(action);
          if (abs.startsWith('http://') || abs.startsWith('https://')) {
            $(el).attr('action', `/fetch?url=${encodeURIComponent(abs)}`);
          }
        }
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send($.html());
    } else {
      // HTML以外が直接リクエストされた場合
      const buffer = await response.buffer();
      res.setHeader('Content-Type', contentType);
      return res.send(buffer);
    }
  } catch (err) {
    res.status(500).send(`プロキシエラー: ${err.message}`);
  }
});

// 2. 画像やCSSなどの静的ファイルを安全に中継するエンドポイント
app.get('/proxy-asset', async (req, res) => {
  const assetUrl = req.query.url;
  if (!assetUrl) return res.status(400).send('URL未指定');

  try {
    const response = await fetch(assetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(assetUrl).origin
      },
      redirect: 'follow'
    });

    const buffer = await response.buffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Asset proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
