import db from './localDB';
import { dev } from '$app/environment';

export type logLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

class Logger {
  group: string;
  constructor(group: string) {
    this.group = group;
  }
  logToDexie(level: logLevel, message: unknown) {
    db.logs.add({
      group: this.group,
      level,
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
