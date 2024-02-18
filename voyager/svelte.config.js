import adapter from 'svelte-kit-sst';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { config as readDotEnv } from 'dotenv';

readDotEnv();

let registerServiceWorker = true;
if (process.env.NODE_ENV === 'development' && process.env.REGISTER_SERVICE_WORKER !== 'true') {
	registerServiceWorker = false;
	console.warn('SvelteKit will NOT register the service worker because NodeJS is currently in development mode and process.env.REGISTER_SERVICE_WORKER is not set to "true".');
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		serviceWorker: {
			register: registerServiceWorker
		},
	},
	onwarn: (warning, handler) => {
		// JL note: importing any @material things inside a svelte file results in spam with these warnings.
		if (warning.code === 'css-unused-selector' || warning.code === 'vite-plugin-svelte-preprocess-many-dependencies') return;
		console.log(warning.code);
		handler(warning);
	}
};

export default config;
