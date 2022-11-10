// Nodemon is configured to ignore the public-src directory, and I don't think it can be configured to run an NPM script
//	so instead, just run this script (or npm run watch-staticfiles)
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import 'colors';
import type {ChildProcessWithoutNullStreams} from 'child_process';

const pathToPublicSrc = path.join(__dirname, '../../public-src');

let doBun = false;
for (let arg of process.argv) {
	if (arg.includes('bun')) {
		doBun = true;
		console.log('Using Bun'.red);
	}
}

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
	
	child = spawn(doBun ? 'bun' : 'npm', [
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
	
	function doTimeout(cb: () => void) {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(cb, 100);
	}
	
	const callback = (type: any, filename: string) => {
		// Only recompile if LESS or TS files are changed
		if ((filename.endsWith('.ts') || filename.endsWith('.less')) && !isWorking) {
			doTimeout(() => {
				kill();
				if (filename.endsWith('.ts')) {
					// Only compile TypeScript files
					console.log('A change has been detected. Reloading...'.red + ' [TypeScript]'.yellow);
					start('compile-ts');
				}
				else if (filename.endsWith('.less')) {
					// Only compile LESS files
					console.log('A change has been detected. Reloading...'.red + ' [LESS]'.yellow);
					start('compile-less');
				}
			});
		}
	};
	
	try {
		fs.watch(pathToPublicSrc, {recursive: true}, callback);
	}
	catch (err) {
		console.error('recursive fs.watch() failed, attempting with individual dirs...');
		fs.watch(path.join(pathToPublicSrc, 'less'), {}, () => {
			doTimeout(() => {
				kill();
				console.log('A change has been detected. Reloading...'.red + ' [LESS]'.yellow);
				start('compile-less');
			});
		});
		fs.watch(path.join(pathToPublicSrc, 'ts'), {}, () => {
			doTimeout(() => {
				kill();
				console.log('A change has been detected. Reloading...'.red + ' [TypeScript]'.yellow);
				if (doBun) start('tsc', path.join(pathToPublicSrc, 'ts'));
				else start('compile-ts-indiv');
			});
		});
		fs.watch(path.join(pathToPublicSrc, 'ts-bundled'), {}, () => {
			doTimeout(() => {
				kill();
				console.log('A change has been detected. Reloading...'.red + ' [Bundled TypeScript]'.yellow);
				if (doBun) start('tsc', path.join(pathToPublicSrc, 'ts-bundled'));
				else start('compile-ts-bundled');
			});
		});
	}
}

init();