import db from './localDB';
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

class Logger {
  group: string;
  constructor(group: string) {
    this.group = group;
  }
  logToDexie(level: logLevel, message: unknown) {
    db.logs.add({
      group: this.group,
      level: logLevelStringToNumber(level),
      message: JSON.stringify(message),
    })
  }

  trace(message: unknown) {
    if (dev) console.debug(message);
    this.logToDexie('trace', message);
  }

  debug(message: unknown) {
    if (dev) console.debug(message);
    this.logToDexie('debug', message);
  }

  info(message: unknown) {
    if (dev) console.log(message);
    this.logToDexie('info', message);
  }

  warn(message: unknown) {
    if (dev) console.warn(message);
    this.logToDexie('warn', message);
  }

  error(message: unknown) {
    if (dev) console.error(message);
    this.logToDexie('error', message);
  }

  fatal(message: unknown) {
    if (dev) console.error(message);
    this.logToDexie('fatal', message);
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
