'use strict';

const upload = require('./uploadhelper');
const matchData = require('./matchdatahelper');

import { Utilities } from '@firstteam102/scoutradioz-utilities';

export class Helpers {
	upload = upload;
	matchData = matchData;
	
	/**
	 * Required: 
	 * @param {object} utilities Already-configured @firstteam102/scoutradioz-utilities module
	 */
	config = (utilities: Utilities) => {
		this.upload.config(utilities);
		this.matchData.config(utilities);
	};
}

module.exports = new Helpers();