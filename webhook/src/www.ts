#!/usr/bin/env node

//for views to either have a base of /prod/ or /
process.env.local = 'true';

/**
 * Module dependencies.
 */

let webhook = require('./webhook');
let http = require('http');

/**
 * Get port from environment and store in Express.
 */

for(let i = 0; i < process.argv.length; i++){
	switch(process.argv[i]){
		case '-port':
		case '--port':
			process.env.PORT = process.argv[i+1];
			break;
	} 
}

let port = normalizePort(process.env.PORT || '3002');
webhook.set('port', port);

/**
 * Create HTTP server.
 */

let server = http.createServer(webhook);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string) {
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

function onError(error: NodeJS.ErrnoException) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	let bind = typeof port === 'string'
		? 'Pipe ' + port
		: 'Port ' + port;

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
	let bind = typeof addr === 'string'
		? 'pipe ' + addr
		: 'port ' + addr.port;
	console.log('Listening on ' + bind);
}
