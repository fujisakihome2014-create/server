self.__uv$config = {
    prefix: '/sw/',
    bare: '/bare/',
    // Ultravioletに依存しない安全なXORエンコード/デコード処理
    encodeUrl: (str) => {
        if (!str) return '';
        try {
            return encodeURIComponent(str.toString().split('').map((char, ind) => 
                ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
            ).join(''));
        } catch (err) {
            return str;
        }
    },
    decodeUrl: (str) => {
        if (!str) return '';
        try {
            return decodeURIComponent(str).split('').map((char, ind) => 
                ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
            ).join('');
        } catch (err) {
            return str;
        }
    },
    handler: 'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.6/dist/uv.handler.js',
    bundle: 'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.6/dist/uv.bundle.js',
    config: '/uv.config.js',
    sw: 'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.6/dist/uv.sw.js',
};
