// Nodemon is configured to ignore the public-src directory, and I don't think it can be configured to run an NPM script
//	so instead, just run this script (or npm run watch-staticfiles)

const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
require('colors');

const pathToPublicSrc = path.join(__dirname, '../public-src');

var child, isWorking;

function kill() {
	if (child) child.kill();
	child = null;
}

function start(command) {
	isWorking = true;
	
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
		console.log('Done! (Waiting for files to change...)'.yellow);
		isWorking = false;
	});
}

var timeout;

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