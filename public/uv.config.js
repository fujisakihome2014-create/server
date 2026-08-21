self.__uv$config = {
    prefix: '/uv/service/',
    bare: '/bare/', // サーバー側の Bare サーバーに直接つなぐ
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv.config.js',
    sw: '/uv/uv.sw.js',
};
