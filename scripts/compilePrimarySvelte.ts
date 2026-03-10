import {
	compile,
} from 'svelte/compiler';
import path from 'path';
import { readdir, lstat, rmdir, mkdir, exists } from 'node:fs/promises';
import { build } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { svelteName } from './names.js';
import { $ } from 'bun';

export async function compilePrimarySvelte() {

	const primaryLoc = path.join(__dirname, '../primary');
	const svelteSrcLoc = path.join(primaryLoc, 'public-src', 'svelte');
	const svelteDestLoc = path.join(primaryLoc, 'public', 'svelte');
	const tailwindInputLoc = path.join(svelteSrcLoc, 'tailwind-input.css');
	const tailwindOutputLoc = path.join(primaryLoc, 'public', 'css', 'tailwind-output.css');

	// read all the files in the current directory, recursively
	const files = await readdir(svelteSrcLoc, { recursive: true });

	const json = await Bun.file(path.join(__dirname, '../package.json')).json();
	const svelteVersion = json.devDependencies.svelte.replace('^', '').replace('~', '');

	// Ensure destination directory exists & is empty
	if (await exists(svelteDestLoc))
		await rmdir(svelteDestLoc, { recursive: true });
	await mkdir(svelteDestLoc);
	
	let compiled = 0;
	let st = performance.now();
	
	let promises: PromiseLike<any>[] = [];

	for (let file of files) {
		try {
			let fullPath = path.join(svelteSrcLoc, file);
			let fullDestPath = path.join(svelteDestLoc, file.replace('.svelte', '.js'));
			if ((await lstat(fullPath)).isDirectory()) continue;
			if (!fullPath.endsWith('.svelte')) continue;
			if (file.startsWith('lib')) continue; // PJL: lib folder doesn't need to be compiled

			// Load svelte source
			const fileObj = Bun.file(fullPath);
			const text = await fileObj.text();
			// Use Svelte's compiler to turn it into JS
			let svelteResult = compile(text, {
				generate: 'client',
				css: 'injected',
				rootDir: svelteSrcLoc,
			});
			// await Bun.write(path.join(svelteDestLoc, file.replace('.svelte', '_sv.js')), svelteResult.js.code);
			// Compile using esbuild
			
			promises.push((async () => {
				const result = await build({
					stdin: {
						contents: svelteResult.js.code,
						resolveDir: path.dirname(fullPath),
						sourcefile: fullPath,
						loader: 'js',
					},
					mainFields: ['svelte', 'browser', 'module', 'main'],
					conditions: ['svelte', 'browser'],
					plugins: [sveltePlugin({
						filterWarnings: (warning) => {
							if (warning.filename?.includes('node_modules')) return false; // disable warnings in libraries
							return true;
						},
						compilerOptions: {
							generate: 'client',
							css: 'injected',
							rootDir: svelteSrcLoc,
						}
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
					.replace(/((?:import|from) *['"])(svelte)/g, `$1https://esm.sh/svelte@${svelteVersion}`);

				await Bun.write(fullDestPath, code);
				
			})());

			compiled++;
		}
		catch (err) {
			console.log(`${svelteName}: ${err}`);
		}
	}
	promises.push($`bun x @tailwindcss/cli -i ${tailwindInputLoc} -o ${tailwindOutputLoc} --cwd ${svelteSrcLoc}`.quiet());
	await Promise.all(promises);
	// await $`bun x @tailwindcss/cli -i ${tailwindInputLoc} -o ${tailwindOutputLoc} --cwd ${svelteSrcLoc}`.quiet();
	console.log(`${svelteName}: Compiled ${compiled} files in ${(performance.now() - st).toFixed(0)} ms (Svelte ${svelteVersion})`);
}

if (require.main === module) {
	compilePrimarySvelte();
}