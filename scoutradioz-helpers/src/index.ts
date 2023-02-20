'use strict';
import type { Utilities } from 'scoutradioz-utilities';

import upload from './uploadhelper';
import matchData from './matchdatahelper';

// Helpers class, to configure in app.js
export class Helpers {
	static upload = upload;
	static matchData = matchData;
	
	/**
	 * Required: 
	 * @param {object} utilities Already-configured scoutradioz-utilities module
	 */
	static config = (utilities: Utilities) => {
		this.upload.config(utilities);
		this.matchData.config(utilities);
	};
}

module.exports = Helpers;
export default Helpers;

// To allow individual imports
export { default as upload } from './uploadhelper';
export { default as matchData } from './matchdatahelper';