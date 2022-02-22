'use strict';

var helpers = {};

helpers.upload = require('./helpers/uploadhelper');
helpers.matchData = require('./helpers/matchdatahelper');

/**
 * Required: 
 * @param {object} utilities Already-configured @firstteam102/scoutradioz-utilities module
 */
helpers.config = function(utilities){
	this.upload.config(utilities);
	this.matchData.config(utilities);
};
module.exports = helpers;