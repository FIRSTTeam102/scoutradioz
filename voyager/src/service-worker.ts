// https://www.sarcevic.dev/offline-first-installable-pwa-sveltekit-workbox-precaching
import { build, files, prerendered, version } from '$service-worker';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Filter out any paths with ".unused" in the path, e.g. IBM Plex Sans fonts that are not being used
let filteredFiles = files.filter(path => !path.match(/\.unused/g));

const precache_list = [
	'/', // Attention: might not be ideal for your use case - read more below.
	...build,
	...filteredFiles,
	...prerendered
].map((s) => ({
	url: s,
	revision: version
}));
precacheAndRoute(precache_list, {
	cleanURLs: false,
});

cleanupOutdatedCaches();

// console.log('List of files that are being precached:', precache_list);