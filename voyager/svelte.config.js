import adapter from 'svelte-kit-sst';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		serviceWorker: {
			register: true,
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
