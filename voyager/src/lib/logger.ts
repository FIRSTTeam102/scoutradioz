import db, { type Log } from './localDB';
import { dev } from '$app/environment';

export type logLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export function logLevelNumberToString(level: number): logLevel {
	switch (level) {
		case 0: return 'trace';
		case 1: return 'debug';
		case 2: return 'info';
		case 3: return 'warn';
		case 4: return 'error';
		case 5: return 'fatal';
		default: return 'info';
	}
}

export function logLevelStringToNumber(level: logLevel): number {
	switch (level) {
		case 'trace': return 0;
		case 'debug': return 1;
		case 'info': return 2;
		case 'warn': return 3;
		case 'error': return 4;
		case 'fatal': return 5;
		default: return 2;
	}
}

// Single buffer & callback for all log streams
let buffer: Log[] = [];
let idleCallbackID: number | undefined;

// Safari doesn't support requestIdleCallback. In this case, just use a regular ole timeout.
if (!('requestIdleCallback' in globalThis)) {
	globalThis.requestIdleCallback = function (cb, options) {
		return setTimeout(cb, options?.timeout);
	}
}

class Logger {
	group: string;
	private funcName?: string;
	constructor(group: string) {
		this.group = group;
	}
	
	setFuncName(name: string) {
		this.funcName = name;
	}
	
	unsetFuncName() {
		this.funcName = undefined;
	}

	async logToDexie(level: logLevel, messages: unknown[]) {
		let str = messages.map(message => {
			if (this.funcName) message = `[${this.funcName}] `;
			if (typeof message === 'string') return message;
			if (message instanceof Error) return String(message);
			else return JSON.stringify(message);
		}).join(' ');

		buffer.push({
			group: this.group,
			level: logLevelStringToNumber(level),
			time: new Date(),
			message: str,
		});

		if (!idleCallbackID) {
			idleCallbackID = requestIdleCallback(async () => {
				await db.logs.bulkAdd(buffer);
				buffer = [];
				idleCallbackID = undefined;
			}, {
				timeout: 1000,
			});
		}
	}
	
	getConsoleLogPrepender() {
		if (this.funcName) return `[${this.group} - ${this.funcName}]`;
		return `[${this.group}]`;
	}

	async trace(...messages: unknown[]) {
		if (globalLogLevel > 0) return;
		if (dev) console.debug(this.getConsoleLogPrepender(), ...messages);
		await this.logToDexie('trace', messages);
	}
  
	async debug(...messages: unknown[]) {
		if (globalLogLevel > 1) return;
		if (dev) console.debug(this.getConsoleLogPrepender(), ...messages);
		await this.logToDexie('debug', messages);
	}
  
	async info(...messages: unknown[]) {
		if (globalLogLevel > 2) return;
		if (dev) console.log(this.getConsoleLogPrepender(), ...messages);
		await this.logToDexie('info', messages);
	}
  
	async warn(...messages: unknown[]) {
		if (globalLogLevel > 3) return;
		if (dev) console.warn(this.getConsoleLogPrepender(), ...messages);
		await this.logToDexie('warn', messages);
	}
  
	async error(...messages: unknown[]) {
		if (globalLogLevel > 4) return;
		if (dev) console.error(this.getConsoleLogPrepender(), ...messages);
		await this.logToDexie('error', messages);
	}
  
	async fatal(...messages: unknown[]) {
		if (globalLogLevel > 5) return;
		if (dev) console.error(this.getConsoleLogPrepender(), ...messages);
		await this.logToDexie('fatal', messages);
	}
}

const loggers: { [key: string]: Logger } = {};

export function getLogger(group?: string) {
	if (!group) group = 'default';
	if (loggers[group]) return loggers[group];
	else {
		loggers[group] = new Logger(group);
		return loggers[group];
	}
}


/** Log level threshold, i.e. any logs below this level will be ignored and not logged */
let globalLogLevel = 1; // default: debug

// Grab saved log level from localStorage.
// TODO maybe: Extract this out of the logger mini-library and put it in some other app-level component?
if ('localStorage' in globalThis) {
	let level = parseInt(String(localStorage.getItem('logLevel')));
	console.log('level', level, typeof level);
	if (!isNaN(level)) {
		globalLogLevel = level;
	}
}


/**
 * Set the log level threshold for all logs, below which all entries will be completely ignored.
 * @param level Level to set
 */
export function setGlobalLogLevel(level: logLevel) {
	globalLogLevel = logLevelStringToNumber(level);
	// Save for later
	localStorage.setItem('logLevel', String(globalLogLevel));
}

/**
 * Get the currently set log level for recording.
 */
export function getGlobalLogLevel() {
	return logLevelNumberToString(globalLogLevel);
}