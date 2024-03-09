import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// If we're building the app, then we want to check and make sure we have the right node-rs modules in our node_modules
if (process.env.NODE_ENV === 'production') {
	let paths = [path.resolve('node_modules', '@node-rs', 'argon2-linux-arm64-gnu'), path.resolve('node_modules', '@node-rs', 'bcrypt-linux-arm64-gnu')];
	for (let path of paths) {
		if (!fs.existsSync(path)) {
			console.error('Required binary packages for user login could not be found in node_modules! Try: yarn add --force --ignore-platform oslo');
			process.exit(1);
		}
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		// https://github.com/sveltejs/kit/issues/11793
		include: ['@smui-extra/autocomplete', '@smui-extra/bottom-app-bar', '@smui/button', '@smui/card', '@smui/checkbox', '@smui/circular-progress', '@smui/common', '@smui/common/internal', '@smui/data-table', '@smui/dialog', '@smui/drawer', '@smui/fab', '@smui/form-field', '@smui/icon-button', '@smui/layout-grid', '@smui/linear-progress', '@smui/list', '@smui/paper', '@smui/ripple', '@smui/select', '@smui/slider', '@smui/snackbar', '@smui/switch', '@smui/tab', '@smui/tab-bar', '@smui/textfield', '@smui/textfield/helper-text', '@smui/tooltip', '@smui/top-app-bar', '@smui/touch-target', 'workbox-precaching', 'workbox-routing', 'svelte-markdown', 'dexie', 'js-cookie', 'oslo/crypto', 'oslo/encoding', 'ua-parser-js', 'qrcode'],
	},
	define: {
		'process.env.NODE_ENV': '"production"'
	}
});
