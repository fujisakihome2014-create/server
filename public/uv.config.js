self.__uv$config = {
    // サイトのURLの先頭につくパス（これを基準にすべてを書き換えます）
    prefix: '/uv/service/',
    
    // Wispが使えない環境でのフォールバック用Bareサーバー
    bare: '/bare/',
    
    // URLの難読化（フィルター回避のため）
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    
    // Ultravioletのコアファイルへの正しいパス
    handler: '/uv/uv.handler.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv.config.js',
    sw: '/uv/uv.sw.js',
};
