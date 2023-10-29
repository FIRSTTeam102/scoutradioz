import db, { type Log } from './localDB';
// import { dev } from '$app/environment';
const dev = false;

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

  async logToDexie(level: logLevel, message: unknown) {
    let str;
    if (typeof message === 'string') str = message;
    else str = JSON.stringify(message);

    buffer.push({
      group: this.group,
      level: logLevelStringToNumber(level),
      message: str,
    })

    if (!idleCallbackID) {
      let stCallback = performance.now(); // temporary
      idleCallbackID = requestIdleCallback(async () => {
        let stBulkAdd = performance.now(); // temporary
        await db.logs.bulkAdd(buffer);
        if (dev) console.log(`logged ${buffer.length} messages in ${performance.now() - stBulkAdd}ms; ${stBulkAdd - stCallback} ms after callback was requested`); // temporary
        buffer = [];
        idleCallbackID = undefined;
      }, {
        timeout: 1000,
      });
    }
  }

  async trace(message: unknown) {
    if (dev) console.debug(message);
    await this.logToDexie('trace', message);
  }

  async debug(message: unknown) {
    if (dev) console.debug(message);
    await this.logToDexie('debug', message);
  }

  async info(message: unknown) {
    if (dev) console.log(message);
    await this.logToDexie('info', message);
  }

  async warn(message: unknown) {
    if (dev) console.warn(message);
    await this.logToDexie('warn', message);
  }

  async error(message: unknown) {
    if (dev) console.error(message);
    await this.logToDexie('error', message);
  }

  async fatal(message: unknown) {
    if (dev) console.error(message);
    await this.logToDexie('fatal', message);
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

console.log(getLogger); // temporary, for debugging
