import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from 'svelte-kit-sst';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		serviceWorker: {
			register: false,
		},
		paths: {
			relative: false,
		}
	},
	onwarn: (warning, handler) => {
		// JL note: importing any @material things inside a svelte file results in spam with these warnings.
		if (warning.code === 'css-unused-selector' || warning.code === 'vite-plugin-svelte-preprocess-many-dependencies') return;
		console.log(warning.code);
		handler(warning);
	}
};

export default config;
