/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

// https://www.sarcevic.dev/offline-first-installable-pwa-sveltekit-workbox-precaching
import { build, files, prerendered, version } from '$service-worker';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Filter out any files starting with a . or in folders starting with a ., i.e. marked as hidden
// 	e.g. .unused folder containing unused font files
let filteredFiles = files.filter((path) => !path.match(/\/\.\w+/g));

const precache_list = [
	'/', // Since the app is CSR, the HTML returned by every route is the same, so we can serve this as a response to every navigate request (initial page load / refresh)
	...build,
	...filteredFiles,
	...prerendered
].map((s) => ({
	url: s,
	revision: version
}));
precacheAndRoute(precache_list, { cleanURLs: false });

// Serve the cached file from '/' on all 'navigate' requests - No need to bother the server!
const navigationRoute = new NavigationRoute(async ({ request }) => {
	const cachedResponse = await matchPrecache('/');
	if (cachedResponse) return cachedResponse;
	// we don't expect this to occur, but yknow, just as a backup
	console.error('Cached index html page not found!! Attempting to fetch.');
	return fetch(request);
});
registerRoute(navigationRoute);

cleanupOutdatedCaches();

// +layout.svelte sends us SKIP_WAITING when the user indicates that they are ready for the app to update
sw.addEventListener('message', (event) => {
	if (event.data && event.data.msg === 'SKIP_WAITING') {
		console.log('Received SKIP_WAITING instruction. Skipping wait...');
		sw.skipWaiting();
	}
});

// This event fires once the service worker (and therefore, the whole app) has finished installing
sw.addEventListener('activate', (event) => {
	console.log('Received activate event. Claiming all clients...');
	event.waitUntil(
		sw.clients.claim().then(() => {
			// Send message back to +layout.svelte that the app has finished updating
			sw.clients.matchAll().then((clients) => clients.forEach((client) => client.postMessage({ msg: 'UPDATE_DONE' })));
		})
	);
});
