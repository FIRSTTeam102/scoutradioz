import adapter from '@firstteam102/yarbsemaj-sveltekit-adapter-lambda';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess({
		postcss: true,
	}),

	kit: {
		adapter: adapter(),
		serviceWorker: {
			register: true
		}
	},
};

export default config;
