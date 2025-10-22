import {
	compile,
} from 'svelte/compiler';
import { mount } from 'svelte';
import path from 'path';
import { readdir, lstat, rmdir, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { svelteName } from './names.js';

export async function compilePrimarySvelte() {

	const primaryLoc = path.join(__dirname, '../primary');
	const svelteSrcLoc = path.join(primaryLoc, 'public-src', 'svelte');
	const svelteDestLoc = path.join(primaryLoc, 'public', 'svelte');

	// read all the files in the current directory, recursively
	const files = await readdir(svelteSrcLoc, { recursive: true });
	
	// Remove all files in svelteDestLoc
	await rmdir(svelteDestLoc, { recursive: true });
	await mkdir(svelteDestLoc);

	for (let file of files) {
		try {
			let fullPath = path.join(svelteSrcLoc, file);
			if ((await lstat(fullPath)).isDirectory()) continue;
			if (!fullPath.endsWith('.svelte')) continue;

			// Load svelte source
			const fileObj = Bun.file(fullPath);
			const text = await fileObj.text();
			// Use Svelte's compiler to turn it into JS
			let svelteResult = compile(text, {
				generate: 'client'
			});
			// Compile using esbuild
			const result = await build({
				stdin: {
					contents: svelteResult.js.code,
					resolveDir: primaryLoc,
					sourcefile: 'input.js',
					loader: 'js',
				},
				mainFields: ['svelte', 'browser', 'module', 'main'],
				conditions: ['svelte', 'browser'],
				plugins: [sveltePlugin({
					filterWarnings: (warning) => {
						if (warning.filename?.includes('node_modules')) return false; // disable warnings in libraries
						return true;
					},
				})],
				external: ['svelte'],
				bundle: true,
				// minify: true,
				write: false, // <-- keep it in memory
				format: 'esm',
			});
			let code = result.outputFiles[0].text;

			// Convert package imports into esm.sh links
			code = code
				.replace(/((?:import|from) *['"])(svelte|@smui)/g, '$1https://esm.sh/$2');

			await Bun.write(path.join(svelteDestLoc, file.replace('.svelte', '.js')), code);

		}
		catch (err) {
			console.log(`${svelteName} ${err}`);
		}
	}
}

if (require.main === module) {
	compilePrimarySvelte();
}