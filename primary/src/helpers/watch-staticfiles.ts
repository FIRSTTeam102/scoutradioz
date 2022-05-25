// Nodemon is configured to ignore the public-src directory, and I don't think it can be configured to run an NPM script
//	so instead, just run this script (or npm run watch-staticfiles)
import fs from 'fs';
import path from 'path';
import {ChildProcessWithoutNullStreams, spawn} from 'child_process';
import 'colors';

const pathToPublicSrc = path.join(__dirname, '../public-src');

let child: ChildProcessWithoutNullStreams|null, 
	isWorking: boolean, 
	startTime: number;

function kill() {
	if (child) child.kill();
	child = null;
}

function start(command: string) {
	isWorking = true;
	startTime = Date.now();
	
	child = spawn('npm', [
		'run',
		command,
	], {shell: true});
	
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
	
	fs.watch(pathToPublicSrc, {recursive: true}, (type, filename) => {
		// Only recompile if LESS or TS files are changed
		if ((filename.endsWith('.ts') || filename.endsWith('.less')) && !isWorking) {
			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(() => {
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
			}, 100);
		}
	});
}

init();