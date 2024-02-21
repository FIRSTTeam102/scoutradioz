import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// If we're building the app, then we want to check and make sure we have the right node-rs modules in our node_modules
if (process.env.NODE_ENV === 'production') {
	let paths = [path.resolve('node_modules', '@node-rs', 'argon2-linux-arm64-gnu'), path.resolve('node_modules', '@node-rs', 'bcrypt-linux-arm64-gnu')];
	for (let path of paths) {
		if (!fs.existsSync(path)) {
			console.error('Required binary packages for user login could not be found in node_modules! Try: yarn add --force --ignore-platform @node-rs/argon2 @node-rs/bcrypt');
			process.exit(1);
		}
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'process.env.NODE_ENV': '"production"'
	}
});
