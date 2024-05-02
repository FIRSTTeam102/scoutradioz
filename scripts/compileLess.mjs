// Script to compile our LESS source into CSS.
import fs from 'fs';
import path from 'path';
import less from 'less';
import LessPluginCleanCss from 'less-plugin-clean-css';
import esMain from 'es-main';

import { pathToLess, pathToPublicCss } from './paths.mjs';
import { lessName, errorName } from './names.mjs';

const cleanCssPlugin = new LessPluginCleanCss({
	advanced: true,
	s1: true,
	compatibility: 'ie8',
});

export async function compileLess() {
	const lessBase = path.join(pathToLess, 'base.less');
	const cssOutput = path.join(pathToPublicCss, 'style.css');
	const mapOutpput = path.join(pathToPublicCss, 'style.css.map');
	
	// mkdir public/css if it doesn't exist
	await fs.promises.mkdir(pathToPublicCss, {recursive: true});
	
	let st = Date.now();
	
	// Load the base LESS script
	let lessContents = await fs.promises.readFile(lessBase, {encoding: 'utf-8'});
	
	// Render LESS & save it to the output file
	less.render(lessContents, {
		plugins: [cleanCssPlugin], 
		paths: [pathToLess],
		sourceMap: {
			sourceMapURL: 'style.css.map',
			outputSourceFiles: true,
			sourceMapRootpath: 'less/',
			sourceMapBasepath: pathToLess, // Remove the full folder path of the LESS source files from the base map
		},
	})
		.then(function (output) {
			console.log(`${lessName}: Compilation complete. (took ${Date.now() - st} ms)`);
			fs.promises.writeFile(cssOutput, output.css, {encoding: 'utf-8'});
			if (output.map)
				fs.promises.writeFile(mapOutpput, output.map, {encoding: 'utf-8'});
		}, function (err) {
			console.error(`${lessName}: ${errorName}: ${err}`);
		});
}

if (esMain(import.meta)) {
	// If this script is called directly (instead of via require), then run the compile script(s) immediately
	compileLess();
}