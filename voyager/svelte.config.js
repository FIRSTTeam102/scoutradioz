// import adapter from '@sveltejs/adapter-auto';
import adapter from '@yarbsemaj/adapter-lambda';
// import adapter from '@sveltejs/adapter-node';
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
		paths: {
			// assets: 'https://scoutradioz-voyager.s3.amazonaws.com'
		}
	},
	
	package: {
		// files: {
		// 	assets: 'https://scoutradioz-voyager.s3.amazonaws.com',
		// },
	},
};

export default config;
