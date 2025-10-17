#!/usr/bin/env node

import child_process from 'child_process';
import 'colors';
import http from 'http';
import { config } from 'dotenv';
import path from 'path';

//for views to either have a base of /prod/ or /
process.env.local = 'true';

config({ path: path.join(__dirname, '../.env.dev') });
console.log(process.env.TIER);

/**
 * Specify some configuration with command line arguments
 */

//eslint-disable-next-line
for (var i = 0; i < process.argv.length; i++) {
	let thisArg = process.argv[i];
	let nextArg = process.argv[i - -1];

	switch (thisArg) {
		case '--port':
			process.env.PORT = nextArg;
			break;
		// JL: disabling NODE_ENV override for Bun support (tracked as https://github.com/oven-sh/bun/issues/556)
		// case '--production':
		// 	console.log('Setting process.env.NODE_ENV=production');
		// 	process.env.NODE_ENV = 'production';
		// 	break;
		case '--watch-staticfiles':
		case '--watch-static':
			launchChildProcess('npm run watch-static');
			break;
		default:
			if (thisArg.substring(0, 2) == '--') {
				console.log(`Setting process.env.${thisArg.substring(2)}=${nextArg}`);
				process.env[thisArg.substring(2)] = nextArg;
			}
			break;
	}
}

function launchChildProcess(command: string, onlyErrors = false, logName?: string) {
	let args = command.split(' ');
	logName = logName || args[args.length - 1];

	let exec = args.shift();
	if (!exec) return console.error('Command invalid!');

	let child = child_process.spawn(exec, args, { shell: true });

	function handleData(data: any) {
		console.log(typeof data);
		// ignore launch messages made by npm/shell that start with >
		if (data.indexOf('>') !== 1) {
			process.stdout.write(`[${logName}] `.magenta + data);
		}
	}

	if (!onlyErrors) child.stdout.on('data', handleData);
	child.stderr.on('data', handleData);
}

/**
 * Module dependencies.
 */

import app from './app';

let port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

let server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: any) {
	let port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: any) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	let bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
	let addr = server.address();
	if (!addr) return;

	let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
	console.log('Listening on ' + bind);
}
