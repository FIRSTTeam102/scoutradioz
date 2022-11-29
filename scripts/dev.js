const fs = require('fs');
const { spawn, ChildProcessWithoutNullStreams } = require('child_process');
require('colors');

const { mongodName, primaryName, uploadName, lessName, errorName } = require('./names');
const { pathToPrimary, pathToUpload, pathToLess } = require('./paths');
const { compileLess } = require('./compileLess');

/** @type ChildProcessWithoutNullStreams  */
let childMongod, 
	/** @type ChildProcessWithoutNullStreams  */
	childPrimary, 
	/** @type ChildProcessWithoutNullStreams  */
	childUpload,
	/** @type ChildProcessWithoutNullStreams  */
	childTS;


// Whether there was a graceful shutdown
let gracefulShutdown = false;

function init() {
	console.clear();
	
	// MONGODB
	
	const mongodbOptions = [];
	// Allow environment variable "MONGODB_PATH" to specify the database path
	if (process.env.MONGODB_PATH) {
		mongodbOptions.push('--dbpath');
		mongodbOptions.push(process.env.MONGODB_PATH);
		console.log(`${mongodName}: Starting with dbpath = "${process.env.MONGODB_PATH}"`);
	}
	
	childMongod = spawn('mongod', mongodbOptions, {cwd: process.cwd(), stdio: ['ipc'], killSignal: 'SIGINT'});
	
	childMongod.on('close', function (status, signal) {
		console.log(`${mongodName}: Process exited with status ${status || signal} (${interpretMongoStatusCode(status)})`);
		// If the database failed to run, then abort the program
		if (status !== 0 && status !== 12 && !gracefulShutdown) {
			console.log('Database closed unexpectedly. Shutting down all scripts.');
			lessWatcher?.close();
			childPrimary?.kill('SIGINT');
			childUpload?.kill('SIGINT');
			childTS?.kill('SIGINT');
			process.exit();
		}
	});
	// Fires whenever mongodb outputs to the console
	childMongod.stdout.on('data', function (data) {
		// console.log(`${mongodName}: ${data}`);
		let str = String(data);
		let split = str.split('\n');
		for (let line of split) {
			if (line) {
				try {
					// https://www.mongodb.com/docs/manual/reference/log-messages/
					let message = JSON.parse(line);
					let severity = message.s;
					// Fatal or Error
					if (severity === 'F' || severity === 'E') {
						let shortMsg = message.msg; // General error message
						let longMsg = message.attr?.error; // Some (or all?) errors will add a more specific error in 'attr'
						console.log(`${mongodName}: ${errorName}: ${shortMsg}`);
						if (longMsg) {
							console.log(`${mongodName}: ${errorName}: ${JSON.stringify(longMsg)}`);
						}
					}
				}
				catch (err) {
					console.log(`Error parsing JSON line from childMongod.stdout: ${err}`);
				}
			}
		}
	});
	// Fires when mongod initializes
	childMongod.on('spawn', function (data) {
		console.log(`${mongodName}: Database has started running.`);
	});
	
	// PRIMARY
	
	// Spawn nodemon (via npx, in case nodemon isn't installed globally) and tell it to only watch for .ts files
	childPrimary = spawn('npx', [
		'nodemon',
		'--ext',
		'ts',
		'./src/www.ts',
	], {shell: true, cwd: pathToPrimary});
	
	childPrimary.on('close', function (status, signal) {
		console.log(`${primaryName}: Process exited with status ${status || signal}.`);
	});
	childPrimary.on('error', function (data) {
		console.error(`${primaryName}: ${errorName}: ${data}`);
		console.log(data);
	});
	childPrimary.stderr.on('data', function (data) {
		console.error(`${primaryName}: ${errorName}: ${data}`);
	});
	childPrimary.stdout.on('data', function (data) {
		let str = String(data);
		let split = str.split('\n');
		// In case multiple lines are sent at once, prepend PRIMARY to every line
		split.forEach(substr => {
			if (substr)
				process.stdout.write(`${primaryName}: ${substr}\n`);
		});
	});
	
	// UPLOAD
	childUpload = spawn('npx', [
		'nodemon',
		'www',
	], {shell: true, cwd: pathToUpload});
	childUpload.on('close', function (status, signal) {
		console.log(`${uploadName}: Process exited with status ${status || signal}.`);
	});
	childUpload.on('error', function (data) {
		console.error(`${uploadName}: ${errorName}: ${data}`);
		console.log(data);
	});
	childUpload.stderr.on('data', function (data) {
		console.error(`${uploadName}: ${errorName}: ${data}`);
	});
	childUpload.stdout.on('data', function (data) {
		let str = String(data);
		let split = str.split('\n');
		// In case multiple lines are sent at once, prepend PRIMARY to every line
		split.forEach(substr => {
			if (substr)
				process.stdout.write(`${uploadName}: ${substr}\n`);
		});
	});
	
	// STATIC TYPESCRIPT
	// 	It's not important to record when this subprocess exits
	childTS = spawn('node', [
		'watchTS.js'
	], {shell: true, cwd: __dirname});
	childTS.stderr.on('data', function (data) {
		process.stderr.write(data); // Newlines & prepends are already included
	});
	childTS.stdout.on('data', function (data) {
		process.stdout.write(data); // Newlines & prepends are already included
	});
	
	// LESS
	// 	Sometimes the fs watcher will fire a change detected instantly, so this timeout will help prevent LESS from compiling twice 
	// 	(also to give the Express servers some time to start up)
	let lessTimeout = setTimeout(() => {
		compileLess();
	}, 500);
	
	let lessWatcher = fs.watch(pathToLess, {}, function () {
		if (lessTimeout) clearTimeout(lessTimeout);
		lessTimeout = setTimeout(() => {
			console.log(`${lessName}: Change detected. Reloading...`);
			compileLess();
		}, 100);
	});
	
	// Text input, allowing "rs" to be typed to restart our Express scripts
	process.stdin.on('data', function (data) {
		let str = String(data).trim();
		if (str.toLowerCase() === 'rs') {
			console.log('Restarting node scripts...');
			childPrimary.stdin.write('rs');
			childUpload.stdin.write('rs');
		}
	});
	
	// This event fires when Ctrl+C is typed in the console, which is how to shut down the program.
	process.on('SIGINT', function () {
		gracefulShutdown = true; // Track that this was a user-requested shutdown.
		console.clear();
		console.log('Gracefully shutting down...');
		
		// Close our file watchers and kill our child processes
		lessWatcher.close();
		childPrimary.kill('SIGINT');
		childUpload.kill('SIGINT');
		childTS.kill('SIGINT');
		
		// The Mongod child process gets passed the SIGINT command automatically and should gracefully exit by itself.
		
		// Stop listening for input
		process.stdin.pause();
	});
}

// From https://www.mongodb.com/docs/manual/reference/exit-codes/
function interpretMongoStatusCode(code) {
	switch (parseInt(code)) {
		case 0: 
		case 12:
			return 'OK';
		case 2:
			return 'The specified options are in error or are incompatible with other options.';
		case 3:
			return 'mismatch between hostnames specified on the command line and in the local.sources collection, in master/slave mode.';
		case 4:
			return 'The version of the database is different from the version supported by the mongod (or exe) instance.';
		case 14:
			return 'Unrecoverable error, uncaught exception, or uncaught signal.';
		case 20:
			return 'Startup failed.';
		case 48:
			return 'Could not start listening for incoming connections.';
		case 61:
			return 'Filesystems with monitored directories are unresponsive.';
		case 62:
			return 'Datafiles in dbpath are incompatible with the version of mongod currently running.';
		case 100:
			return 'Uncaught exception.';
		default:
			return 'Unknown error code!';
	}
}

init();