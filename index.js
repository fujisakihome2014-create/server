import express from 'express';
import { createServer } from 'node:http';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';

import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 自前のpublicを最優先で配信(index.html, sw.js など)
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// 学習用の簡易サーバーサイドモード
// サーバー自身がURLを取得し、HTML/CSS内のリンクを /fetch/... 経由に書き換えて返す。
// Cookie(ログインセッション)の保持と、POSTフォームの送信に対応。
// ただしJavaScriptの書き換えは行わないので、動的サイト(SPA)は対象外。
// ---------------------------------------------------------------------------
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
};

// セッションごと・接続先ホストごとにCookieを保持する簡易インメモリストア
// (サーバー再起動でリセットされる。本格的な永続化はしていない)
const cookieStore = new Map(); // sessionId -> Map(hostname -> Map(cookieName -> cookieValue))

function getSessionId(req, res) {
    let sid = req.headers.cookie && req.headers.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('sjsid='));
    sid = sid ? sid.slice('sjsid='.length) : null;

    if (!sid) {
        sid = crypto.randomBytes(16).toString('hex');
        res.cookie('sjsid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 });
    }
    if (!cookieStore.has(sid)) cookieStore.set(sid, new Map());
    return sid;
}

function getCookieHeaderFor(sessionId, hostname) {
    const jar = cookieStore.get(sessionId);
    if (!jar || !jar.has(hostname)) return '';
    const cookies = jar.get(hostname);
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeSetCookies(sessionId, hostname, setCookieValues) {
    if (!setCookieValues || !setCookieValues.length) return;
    const jar = cookieStore.get(sessionId);
    if (!jar.has(hostname)) jar.set(hostname, new Map());
    const cookies = jar.get(hostname);
    for (const raw of setCookieValues) {
        const firstPart = raw.split(';')[0];
        const eqIdx = firstPart.indexOf('=');
        if (eqIdx === -1) continue;
        const name = firstPart.slice(0, eqIdx).trim();
        const value = firstPart.slice(eqIdx + 1).trim();
        if (/expires=Thu, 01 Jan 1970/i.test(raw) || value === '') {
            cookies.delete(name);
        } else {
            cookies.set(name, value);
        }
    }
}

function toFetchUrl(rawUrl, baseUrl) {
    if (!rawUrl) return null;
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:') ||
        trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
        return null;
    }
    try {
        const abs = new URL(trimmed, baseUrl).href;
        return '/fetch/' + encodeURIComponent(abs);
    } catch (e) {
        return null;
    }
}

// CSS内の url(...) を書き換える(<style>タグ・style属性・外部CSSファイル共通)
function rewriteCssUrls(css, baseUrl) {
    return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => {
        const rewritten = toFetchUrl(url, baseUrl);
        return rewritten ? 'url(' + quote + rewritten + quote + ')' : match;
    });
}

// srcset(レスポンシブ画像用の複数URL+解像度指定)を書き換える
function rewriteSrcset(value, baseUrl) {
    return value.split(',').map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return part;
        const spaceIdx = trimmed.search(/\s/);
        const urlPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
        const descriptor = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx);
        const rewritten = toFetchUrl(urlPart, baseUrl);
        return rewritten ? rewritten + descriptor : trimmed;
    }).join(', ');
}

// フォームのaction/methodを、送信後も /fetch/ 経由になるよう補強する。
// (GETフォームはブラウザがaction URLへ独自にクエリを追加するため、
//  action自体を一旦「素のターゲットURL」を隠し持つ形にはできないので、
//  method=GETのフォームだけ action を書き換えず素通しし、
//  代わりに hidden input で本来の遷移先を持たせる簡易対応は行わない。
//  ここではPOSTフォームの正しい転送を優先する)
// 実行時のfetch/XHR/動的なsrc・href代入を/fetch/経由に差し替える注入スクリプト。
// location.href直接代入やWebSocketは対象外(ブラウザ仕様上インターセプトが困難なため)。
function buildShim(finalUrl) {
    return '<script>(function(){' +
        'var __BASE__=' + JSON.stringify(finalUrl) + ';' +
        'function toFetchUrl(u){' +
        'if(!u)return u;' +
        'try{' +
        'if(/^(data:|blob:|javascript:|#|about:|\\/fetch\\/)/i.test(u))return u;' +
        'return "/fetch/"+encodeURIComponent(new URL(u,__BASE__).href);' +
        '}catch(e){return u;}' +
        '}' +
        'var oF=window.fetch;' +
        'window.fetch=function(i,init){' +
        'if(typeof i==="string")i=toFetchUrl(i);' +
        'else if(i&&i.url)i=new Request(toFetchUrl(i.url),i);' +
        'return oF.call(this,i,init);' +
        '};' +
        'var oO=XMLHttpRequest.prototype.open;' +
        'XMLHttpRequest.prototype.open=function(m,u){' +
        'arguments[1]=toFetchUrl(u);' +
        'return oO.apply(this,arguments);' +
        '};' +
        '["src","href"].forEach(function(p){' +
        '[window.HTMLImageElement,window.HTMLScriptElement,window.HTMLLinkElement,window.HTMLIFrameElement,window.HTMLSourceElement].forEach(function(C){' +
        'if(!C)return;' +
        'var d=Object.getOwnPropertyDescriptor(C.prototype,p)||Object.getOwnPropertyDescriptor(HTMLElement.prototype,p)||Object.getOwnPropertyDescriptor(Element.prototype,p);' +
        'if(!d||!d.set)return;' +
        'Object.defineProperty(C.prototype,p,{get:d.get,configurable:true,set:function(v){d.set.call(this,toFetchUrl(v));}});' +
        '});' +
        '});' +
        'var oS=Element.prototype.setAttribute;' +
        'Element.prototype.setAttribute=function(n,v){' +
        'if((n==="src"||n==="href")&&v)v=toFetchUrl(v);' +
        'return oS.call(this,n,v);' +
        '};' +
        '})();</' + 'script>';
}

async function fetchTarget(target, sessionId, method, body, contentType) {
    const hostname = new URL(target).hostname;
    const headers = { ...BROWSER_HEADERS };
    const cookieHeader = getCookieHeaderFor(sessionId, hostname);
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    if (contentType) headers['Content-Type'] = contentType;

    const upstream = await fetch(target, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
        redirect: 'follow',
    });

    const setCookies = typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : [];
    storeSetCookies(sessionId, hostname, setCookies);

    return upstream;
}

async function handleProxyRequest(req, res, method) {
    let target;
    try {
        target = decodeURIComponent(req.originalUrl.slice('/fetch/'.length));
    } catch (e) {
        target = req.originalUrl.slice('/fetch/'.length);
    }
    // POSTの場合、クエリ文字列部分がoriginalUrlに紛れ込むことがあるため整形
    target = target.split('#')[0];

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        return res.status(400).send('Invalid target URL');
    }

    const sessionId = getSessionId(req, res);

    try {
        const upstream = await fetchTarget(
            target,
            sessionId,
            method,
            method === 'GET' ? undefined : req.body,
            req.headers['content-type']
        );

        const contentType = upstream.headers.get('content-type') || '';
        const finalUrl = upstream.url || target;

        if (contentType.includes('text/html')) {
            let html = await upstream.text();

            const rewriteAttr = (source, attr) => {
                const re = new RegExp(attr + '\\s*=\\s*(["\'])(.*?)\\1', 'gi');
                return source.replace(re, (match, quote, value) => {
                    if (!value) return match;
                    if (attr === 'srcset') {
                        return attr + '=' + quote + rewriteSrcset(value, finalUrl) + quote;
                    }
                    const rewritten = toFetchUrl(value, finalUrl);
                    return rewritten ? attr + '=' + quote + rewritten + quote : match;
                });
            };

            html = rewriteAttr(html, 'href');
            html = rewriteAttr(html, 'src');
            html = rewriteAttr(html, 'srcset');

            const shim = buildShim(finalUrl);
            html = /<head[^>]*>/i.test(html)
                ? html.replace(/<head[^>]*>/i, (m) => m + shim)
                : shim + html;

            // <form action="..." method="post"> のactionは書き換えず、
            // 素のターゲットURLを data-fetch-target に保持しておき、
            // 送信時に <script> がaction先を /fetch/... に組み立て直す
            html = html.replace(
                /<form\b([^>]*)>/gi,
                (m, attrs) => {
                    const actionMatch = attrs.match(/action\s*=\s*(["'])(.*?)\1/i);
                    const rawAction = actionMatch ? actionMatch[2] : finalUrl;
                    let absAction;
                    try { absAction = new URL(rawAction, finalUrl).href; } catch (e) { absAction = finalUrl; }
                    const newAttrs = actionMatch
                        ? attrs.replace(actionMatch[0], `action="/fetch/${encodeURIComponent(absAction)}"`)
                        : attrs + ` action="/fetch/${encodeURIComponent(absAction)}"`;
                    return `<form${newAttrs}>`;
                }
            );

            // <style>...</style> 内のurl()を書き換え
            html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
                (m, open, css, close) => open + rewriteCssUrls(css, finalUrl) + close);

            // style="..." 属性内のurl()を書き換え
            html = html.replace(/style\s*=\s*(["'])(.*?)\1/gi,
                (m, quote, css) => 'style=' + quote + rewriteCssUrls(css, finalUrl) + quote);

            // <meta http-equiv="refresh" content="秒数;url=..."> の自動リダイレクトに対応
            html = html.replace(
                /(<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'])([^"']*)(["'])/gi,
                (m, pre, content, post) => {
                    const match = content.match(/^(\d+)\s*;\s*url=(.+)$/i);
                    if (!match) return m;
                    const rewritten = toFetchUrl(match[2].trim(), finalUrl);
                    return rewritten ? pre + match[1] + ';url=' + rewritten + post : m;
                }
            );

            res.status(upstream.status);
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } else if (contentType.includes('text/css')) {
            const css = await upstream.text();
            res.status(upstream.status);
            res.set('Content-Type', 'text/css; charset=utf-8');
            res.send(rewriteCssUrls(css, finalUrl));
        } else {
            res.status(upstream.status);
            res.set('Content-Type', contentType || 'application/octet-stream');
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.send(buf);
        }
    } catch (err) {
        res.status(502).send('サーバーモードでの取得に失敗しました: ' + err.message);
    }
}

// Cookie送出用に必要な最低限のCookieパーサ(cookie-parserは未導入のため自前で)
app.use((req, res, next) => {
    res.cookie = (name, value, opts = {}) => {
        const parts = [`${name}=${value}`];
        if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
        if (opts.httpOnly) parts.push('HttpOnly');
        if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
        parts.push('Path=/');
        res.append('Set-Cookie', parts.join('; '));
    };
    next();
});

app.get('/fetch/*', (req, res) => handleProxyRequest(req, res, 'GET'));

// POSTフォーム送信対応(urlencoded / multipart / それ以外の生データすべてを転送)
app.post(
    '/fetch/*',
    express.raw({ type: '*/*', limit: '25mb' }),
    (req, res) => handleProxyRequest(req, res, 'POST')
);

// ベンダー(公式Scramjet/libcurl/bare-mux)の配信ファイル
app.use('/scram/', express.static(scramjetPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));

// それ以外は404
app.use((req, res) => {
    res.status(404).send('Not Found');
});

const server = createServer();

server.on('request', (req, res) => {
    // COOP/COEP: SharedArrayBufferを使うゲームサイト等のために必要
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    app(req, res);
});

// WebSocketのアップグレードはWispプロトコルへ
server.on('upgrade', (req, socket, head) => {
    if (req.url.endsWith('/wisp/')) {
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log(`Server running on port ${port}`));
