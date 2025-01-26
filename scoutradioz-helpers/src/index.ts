'use strict';
import type { Utilities } from 'scoutradioz-utilities';

import upload from './uploadhelper.js';
import matchData from './matchdatahelper.js';

/**
 * Required:
 * @param {object} utilities Already-configured scoutradioz-utilities module
 */
export function config(utilities: any) {
	upload.config(utilities);
	matchData.config(utilities);
}

// To allow individual imports
export { default as upload } from './uploadhelper.js';
export { default as matchData } from './matchdatahelper.js';
export * from './derivedhelper.js';