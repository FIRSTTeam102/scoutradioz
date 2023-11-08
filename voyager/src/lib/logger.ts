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

class Logger {
	group: string;
	constructor(group: string) {
		this.group = group;
	}

	async logToDexie(level: logLevel, messages: unknown[]) {
		let str = messages.map(message => {
			if (typeof message === 'string') return message;
			else return JSON.stringify(message);
		}).join(' ');

		buffer.push({
			group: this.group,
			level: logLevelStringToNumber(level),
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

	async trace(...messages: unknown[]) {
		if (dev) console.debug(`[${this.group}]`, ...messages);
		await this.logToDexie('trace', messages);
	}
  
	async debug(...messages: unknown[]) {
		if (dev) console.debug(`[${this.group}]`, ...messages);
		await this.logToDexie('debug', messages);
	}
  
	async info(...messages: unknown[]) {
		if (dev) console.log(`[${this.group}]`, ...messages);
		await this.logToDexie('info', messages);
	}
  
	async warn(...messages: unknown[]) {
		if (dev) console.warn(`[${this.group}]`, ...messages);
		await this.logToDexie('warn', messages);
	}
  
	async error(...messages: unknown[]) {
		if (dev) console.error(`[${this.group}]`, ...messages);
		await this.logToDexie('error', messages);
	}
  
	async fatal(...messages: unknown[]) {
		if (dev) console.error(`[${this.group}]`, ...messages);
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