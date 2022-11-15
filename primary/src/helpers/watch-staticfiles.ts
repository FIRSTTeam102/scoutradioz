// Nodemon is configured to ignore the public-src directory, and I don't think it can be configured to run an NPM script
//	so instead, just run this script (or npm run watch-staticfiles)
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import 'colors';
import type {ChildProcessWithoutNullStreams} from 'child_process';

const pathToPublicSrc = path.join(__dirname, '../../public-src');
const pathToLess = path.join(pathToPublicSrc, 'less');
const pathToTs = path.join(pathToPublicSrc, 'ts');
const pathToTsBundled = path.join(pathToPublicSrc, 'ts-bundled');

// // To use bun instead of node for faster compilation
// let doBun = false;
// if (process.argv[0].endsWith('bun')) {
// 	doBun = true;
// }
// try {
// 	let bunProcess = spawn('bunne', ['-v']);
// 	bunProcess.on('error', function (data) {
// 		// if child_process.spawn fails, just proceed, it's fine
// 		init();
// 	});
// 	bunProcess.on('exit', function (data) {
// 		if (data === 0) {
// 			doBun = true;
// 		}
// 		init();
// 	});
// }
// catch (err) {
// 	// if child_process.spawn fails, just proceed, it's fine
// 	init();
// }


let child: ChildProcessWithoutNullStreams|null, 
	isWorking: boolean, 
	startTime: number;

function kill() {
	if (child) child.kill();
	child = null;
}

function start(command: string, cwd?: string) {
	isWorking = true;
	startTime = Date.now();
	
	// child = spawn(doBun ? 'bun' : 'npm', [
	// 	'run',
	// 	command,
	// ], {shell: true, cwd: cwd});
	
	child = spawn('npm', [
		'run',
		command,
	], {shell: true, cwd: cwd});
	
	if (cwd) console.log(command, cwd);
	
	child.stdout.on('data', function (data) {
		process.stdout.write(data);
	});
	
	child.stderr.on('data', function (data) {
		process.stdout.write(data);
	});
	
	child.on('exit', function (data) {
		console.log(`Done! [${Date.now() - startTime} ms] (Waiting for files to change...)`.yellow);
		isWorking = false;
	});
}

let timeout: NodeJS.Timeout;

function init() {
	start('compile-static'); // Start by compiling all static files
	
	try {
		doWatch(true);
	}
	catch (err) {
		console.log('Recursive watch failed. Attempting non-recursive watch.');
		doWatch(false);
	}
	
	function doWatch(recursive: boolean) {
		
		const time = 100;
	
		let opts;
		if (recursive) opts = {}; // recursive might not be supported
		else opts = {recursive: true};
		
		// LESS files
		fs.watch(pathToLess, opts, (type, filename) => {
			if (filename.endsWith('.less') && !isWorking) {
				if (timeout) clearTimeout(timeout);
				timeout = setTimeout(() => {
					console.log('A change has been detected. Reloading...'.red + ' [LESS]'.yellow);
					start('compile-less');
				}, time); 
			}
		});
		
		// Individual TS files
		fs.watch(pathToTs, opts, (type, filename) => {
			if (filename.endsWith('.ts') && !isWorking) {
				if (timeout) clearTimeout(timeout);
				timeout = setTimeout(() => {
					console.log('A change has been detected. Reloading...'.red + ' [TS]'.yellow);
					start('compile-ts-indiv');
				}, time); 
			}
		});
		
		// Bundled TS files
		fs.watch(pathToTsBundled, opts, (type, filename) => {
			if (filename.endsWith('.ts') && !isWorking) {
				if (timeout) clearTimeout(timeout);
				timeout = setTimeout(() => {
					console.log('A change has been detected. Reloading...'.red + ' [TS bundled]'.yellow);
					start('compile-ts-bundled');
				}, time); 
			}
		});
	}
}

init();