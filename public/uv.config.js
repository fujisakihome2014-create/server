self.__uv$config = {
    prefix: '/sw/',
    bare: '/bare/',
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
    handler: '/uv/uv.handler.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv.config.js',
    sw: '/uv/uv.sw.js',
};
