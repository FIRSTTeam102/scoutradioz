// https://www.sarcevic.dev/offline-first-installable-pwa-sveltekit-workbox-precaching
import { build, files, prerendered, version } from '$service-worker';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Filter out any paths with ".unused" in the path, e.g. IBM Plex Sans fonts that are not being used
let filteredFiles = files.filter((path) => !path.match(/\.unused/g));

const precache_list = [
	'/', // Attention: might not be ideal for your use case - read more below.
	...build,
	...filteredFiles,
	...prerendered
].map((s) => ({
	url: s,
	revision: version
}));
precacheAndRoute(precache_list, { cleanURLs: false });

cleanupOutdatedCaches();

// self.addEventListener('install', (event) => {
// 	console.log('install event fired!');
// 	event.waitUntil(
// 		self.clients
// 			.matchAll()
// 			.then((clients) => clients.forEach((client) => client.postMessage({ msg: 'INSTALL_DONE' })))
// 	);
// });

// console.log('List of files that are being precached:', precache_list);

// Add message event handler
self.addEventListener('message', (event) => {
	if (event.data && event.data.msg === 'SKIP_WAITING') {
		console.log('Received SKIP_WAITING instruction. Skipping wait...');
		self.skipWaiting();
	}
});

self.addEventListener('activate', (event) => {
	console.log('Received activate event. Claiming all clients...');
	event.waitUntil(
		self.clients.claim().then(() => {
			self.clients
				.matchAll()
				.then((clients) => clients.forEach((client) => client.postMessage({ msg: 'UPDATE_DONE' })));
		})
	);
});
