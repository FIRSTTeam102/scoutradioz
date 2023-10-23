import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit(), mkcert()],
	// JL note: It seems like after vite-plugin-mkcert downloads certificates, vite automatically
	// 	serves https if server.https is not specified. I feel like it's useful to default to false
	// 	unless you add --https to the command line args.
	server: {
		https: false,
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	}
};

export default config;
