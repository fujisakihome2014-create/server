importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@2.1.0/dist/uv.bundle.js');
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@2.1.0/dist/uv.config.js');
importScripts(__uv$config.sw);

const uv = new UVServiceWorker();

self.addEventListener('fetch', event => {
    event.respondWith(
        uv.fetch(event)
    );
});
