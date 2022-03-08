// https://web.dev/offline-fallback-page/

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open('pwa').then(cache => {
			return cache.addAll([
				'/offline.html'
			]);
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			if ('navigationPreload' in self.registration) await self.registration.navigationPreload.enable();
		})()
	);
});

self.addEventListener('fetch', event => {
	if (event.request.mode === 'navigate') event.respondWith(
		/*caches.open('pwa').then(cache => {
			return cache.match(event.request).then(res => {
				return res || fetch(event.request).catch(err => {
					console.error(err);
					return caches.match('/offline.html');
				})
			})
		})*/
		(async () => {
			try {
				const preloadResponse = await event.preloadResponse;
				if (preloadResponse) return preloadResponse;

				const networkResponse = await fetch(event.request);
				return networkResponse;
			} catch (err) {
				return caches.open('pwa').then(cache => {
					return cache.match('/offline.html');
				})
			}
		})()
	);
});