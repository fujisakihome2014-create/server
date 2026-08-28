self.Ultraviolet = self.Ultraviolet || {};
Ultraviolet.codec = {
    xor: {
        encode(str) {
            if (!str) return '';
            let encode = '';
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code === 37) { // '%'
                    encode += '%';
                } else {
                    encode += String.fromCharCode(code ^ 2);
                }
            }
            return encode;
        },
        decode(str) {
            if (!str) return '';
            let decode = '';
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code === 37) {
                    decode += '%';
                } else {
                    decode += String.fromCharCode(code ^ 2);
                }
            }
            return decode;
        }
    }
};

class UVServiceWorker {
    constructor() {}
    async fetch(event) {
        const url = new URL(event.request.url);
        const bareUrl = '/bare/' + url.pathname.replace(self.__uv$config.prefix, '') + url.search;
        return fetch(bareUrl, {
            method: event.request.method,
            headers: event.request.headers,
            body: event.request.body,
            redirect: event.request.redirect
        });
    }
}
self.UVServiceWorker = UVServiceWorker;
