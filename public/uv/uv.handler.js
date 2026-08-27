/* Ultraviolet Client Handler */
if (typeof window !== 'undefined') {
    // ページ内のリンクやフェッチをプロキシ経由に書き換えるためのフック
    const rawFetch = window.fetch;
    window.fetch = async function(input, init) {
        let url = typeof input === 'string' ? input : input.url;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            input = __uv$config.prefix + __uv$config.encodeUrl(url);
        }
        return rawFetch(input, init);
    };
}
