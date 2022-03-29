/* eslint-disable global-require */
'use strict';
var logger;
try {
	logger = require('log4js').getLogger('helpers.matchData');
}
catch(err) {
	logger = require('@log4js-node/log4js-api').getLogger('helpers.matchData');
}
logger.level = process.env.LOG_LEVEL || 'debug';

var ztable = require('ztable');

/** @type import('../../scoutradioz-utilities/utilities') */ 
var utilities = null;
var matchDataHelper = module.exports = {};

/**
 * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
 * @param {import('../../scoutradioz-utilities/utilities')} utilitiesModule 
 */
matchDataHelper.config = function(utilitiesModule){
	utilities = utilitiesModule;
};

/**
 * Returns whether a layout element type is quantifiable.
 * @param {string} type Type of layout element
 * @return {boolean} isQuantifiable
 */
matchDataHelper.isQuantifiableType = function(type) {
	
	var isQuantifiable;
	
	switch (type) {
		case 'checkbox':
		case 'counter':
		case 'badcounter':
		case 'derived':
		case 'slider':
		case 'timeslider':
			isQuantifiable = true;
			break;
		default:
			isQuantifiable = false;
	}
	
	return isQuantifiable;
};

/**
 * Adjusts the data type of a given datum based on its layout type. Numerical elements are transformed into numbers, checkboxes are transformed into 0/1, and others are kept as strings.
 * Use to "sanitize" the input from HTML forms into the database.
 * @param {string|number} value The metric/datum to fix
 * @param {string} type The type of the element, e.g. checkbox/counter/slider.
 * @return {string|number} 
 */
matchDataHelper.fixDatumType = function(value, type) {
	
	var newVal;
	
	// Note: Derived metrics are always returned as numbers (but this method should not be called for derived metrics)
	switch (type) {
		case 'checkbox': {
			if (value === 'true' || value === true) newVal = 1;
			else newVal = 0;
			break;
		}
		case 'counter':
		case 'badcounter':
		case 'slider':
		case 'timeslider': {
			newVal = -1;
			let parsedVal = parseInt(value);
			if (!isNaN(parsedVal)) newVal = parsedVal;
			break;
		}
		default:
			newVal = value;
	}
	
	return newVal;
};

/**
 * Returns whether a layout element type is a metric.
 * @param {string} type Type of layout element
 * @return {boolean} isMetric
 */
matchDataHelper.isMetric = function(type) {
	
	var isMetric;
	
	switch (type) {
		case 'spacer':
		case 'h2':
		case 'h3':
			isMetric = false;
			break;
		default:
			isMetric = true;
	}
	
	return isMetric;
};

// const {performance} = require('perf_hooks');

/**
 * Calculate derived metrics for a provided array of match data items.
 * @param {string} org_key Org key
 * @param {number} event_year Year of event
 * @param {Object} matchData Scouting data ("data" field in the db)
 * @returns {Object} matchData - Same object, not cloned, with the derived metrics added
 */
matchDataHelper.calculateDerivedMetrics = async function(org_key, event_year, matchData) {
	// let st = performance.now();
	// Just derived fields from the org's match scouting layout for this year
	var derivedLayout = await utilities.find('layout', 
		{org_key: org_key, year: event_year, form_type: 'matchscouting', type: 'derived'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	// let dt = performance.now();

	for (let thisItem of derivedLayout) {
		let derivedMetric = NaN;
		// JL - Note: I don't want to do any error checking in here, to minimize the amount of computation time needed.
		//	Error checking should be done at the time of creating the layout. (TODO: error checking :] )
		//	The very last operator must NOT have an "as", and every consequent operator should probably have an "as"
		let operations = thisItem.operations;
		let variables = {};
		let length = operations.length;
		
		for (let i = 0; i < length; i++) {
			let thisOp = operations[i];
			let operands = thisOp.operands;
			switch (thisOp.operator) {
				// sum operands: [a, b, c, ...]
				case 'sum': case 'add': {
					let sum = 0;
					for (let key of operands) {
						if (typeof key === 'number') sum += key;
						else if (key.startsWith('$')) sum += variables[key]; // local "as" variable higher in the chain
						else sum += parseNumber(matchData[key]);
					}
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = sum;
					else derivedMetric = sum;
					logger.trace(`Sum: ${sum} -> ${thisOp.as || ''}`);
					break;
				}
				// multiply operands: [a, b, c, ...]
				case 'multiply': {
					let product = 1;
					for (let key of operands) {
						if (typeof key === 'number') product *= key;
						else if (key.startsWith('$')) product *= variables[key];
						else product *= parseNumber(matchData[key]);
					}
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = product;
					else derivedMetric = product;
					logger.trace(`Multiply: ${product} -> ${thisOp.as || ''}`);
					break;
				}
				// subtract operands: [minuend, subtrahend] (a - b -> [a, b])
				case 'subtract': {
					let minuendKey = operands[0];
					let subtrahendKey = operands[1];
					let difference;
					
					if (typeof minuendKey === 'number') difference = minuendKey;
					else if (minuendKey.startsWith('$')) difference = variables[minuendKey];
					else difference = parseNumber(matchData[minuendKey]);
					
					if (typeof subtrahendKey === 'number') difference -= subtrahendKey;
					else if (subtrahendKey.startsWith('$')) difference -= variables[subtrahendKey];
					else difference -= parseNumber(matchData[subtrahendKey]);
					
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = difference;
					else derivedMetric = difference;
					logger.trace(`Subtract: ${difference} -> ${thisOp.as || ''}`);
					break;
				}
				// divide operands: [dividend, divisor] (a/b -> [a, b])
				case 'divide': {
					let dividendKey = operands[0];
					let divisorKey = operands[1];
					let dividend, divisor, quotient;
					
					if (typeof dividendKey === 'number') dividend = dividendKey;
					else if (dividendKey.startsWith('$')) dividend = variables[dividendKey];
					else dividend = parseNumber(matchData[divisorKey]);
					
					if (typeof divisorKey === 'number') divisor = divisorKey;
					if (divisorKey.startsWith('$')) divisor = variables[divisorKey];
					else divisor = parseNumber(matchData[divisorKey]);
					
					if (divisor === 0) quotient = 0; // Making divisions by 0 equal to 0 provides more helpful metrics, even if it doesn't make mathematical sense
					else quotient = dividend / divisor;
					
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = quotient;
					else derivedMetric = quotient;
					logger.trace(`Divide: ${quotient} -> ${thisOp.as || ''}`);
					break;
				}
				// multiselect quantifiers: {option1: value1, option2: value2, ...}; variables not supported
				case 'multiselect': {
					let key = matchData[thisOp.id];
					let value = parseNumber(thisOp.quantifiers[key]);
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = value;
					else derivedMetric = value;
					logger.trace(`Multiselect: key=${key} ${value} -> ${thisOp.as || ''}`);
					break;
				}
				// condition operands: [boolean, valueIfTrue, valueIfFalse]
				case 'condition': {
					let conditionKey = operands[0];
					// ifTrue and ifFalse can either be a string (therefore being a variable/metric key) or a value, which can be either a number or explicitly null
					let ifTrueKey = operands[1]; 
					let ifFalseKey = operands[2];
					let condition, value;
					
					// Condition must be a variable or metric value, otherwise there's no reason to use this operation
					if (conditionKey.startsWith('$')) condition = parseBoolean(variables[conditionKey]);
					else condition = parseBoolean(matchData[conditionKey]);
					
					if (isNaN(condition)) {
						value = NaN; // We must be cautious in the case where gt/gte/etc has NaN as a result
					}
					else if (condition) {
						if (typeof ifTrueKey === 'string') {
							if (ifTrueKey.startsWith('$')) value = variables[ifTrueKey];
							else value = parseNumber(matchData[ifTrueKey]);
						}
						// If it's not a string, then just take the value as provided
						//	Doing this differently than above because typeof null returns 'object'
						else value = ifTrueKey;
					}
					else {
						if (typeof ifFalseKey === 'string') {
							if (ifFalseKey.startsWith('$')) value = variables[ifFalseKey];
							else value = parseNumber(matchData[ifFalseKey]);
						}
						else value = ifFalseKey;
					}
					
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = value;
					else derivedMetric = value;
					logger.trace(`Condition: ${condition}, true=${ifTrueKey} false=${ifFalseKey}, ${value} -> ${thisOp.as || ''}`);
					break;
				}
				// Comparison operations all act basically the same, except with a different operator, so we can share the same code
				//	Future note for building an error checking script: Make sure that the output of any of these operators is NOT used in sum, multiply, etc. Only in conditionals.
				//	operands ex: gt: [a, b] -> true if a > b, false if a <= b
				case 'gt': case 'gte': case 'lt': case 'lte': case 'eq': case 'ne': {
					let aKey = operands[0];
					let bKey = operands[1];
					let a, b, result;
					
					if (typeof aKey === 'number') a = aKey;
					else if (aKey.startsWith('$')) a = variables[aKey];
					else a = parseNumber(matchData[aKey]);
					
					if (typeof bKey === 'number') b = bKey;
					else if (bKey.startsWith('$')) b = variables[bKey];
					else b = parseNumber(matchData[bKey]);
					
					// Yes, we can have switch statements inside another switch statement :D
					switch (thisOp.operator) {
						case 'gt': result = a > b; 	 break;
						case 'gte': result = a >= b; break;
						case 'lt': result = a < b;   break;
						case 'lte': result = a <= b; break;
						case 'eq': result = a === b; break;
						case 'ne': result = a !== b; break;
					}
					if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = result;
					else derivedMetric = result ? 1 : 0; // If it's an output, then return a 1 or 0 instead of true or false (even though we can do math on true & false)
					logger.trace(`${thisOp.operator}: a=${aKey}->${a}, b=${bKey}->${b}; ${result} -> ${thisOp.as || ''}`);
					break;
				}
			}
		}
		logger.trace(`Final metric: ${derivedMetric} - Label: ${thisItem.label} / ${thisItem.id}`);
		// Insert the newly derived metric into 
		matchData[thisItem.id] = derivedMetric;
	}
	
	function parseBoolean(item) {
		if (item === 'false') return false;
		else return !!item;
	}
	
	// Turns checkboxes into 0 and 1
	function parseNumber(item) {
		if (item === 'true' || item === true) return 1;
		else if (item === 'false' || item === false) return 0;
		else return parseFloat(item);
	}
	// logger.trace(`${dt - st}, ${performance.now() - dt}`);
	
	return matchData;
};

/**
 * @param {string} org_key Org key
 * @param {number} event_year Year of event
 * @param {string} colCookie Comma-separated list of metric IDs
 * @return {array} Modified (reduce) match scouting layout, from the list in colCookie
 */
matchDataHelper.getModifiedMatchScoutingLayout = async function(org_key, event_year, colCookie) {
	logger.addContext('funcName', 'getModifiedMatchScoutingLayout');
	logger.info('ENTER org_key=' + org_key + ',event_year=' + event_year + ',colCookie=' + colCookie);
    
	// create the return array
	var scorelayout = [];

	// read in the layout as stored in the DB
	var scorelayoutDB = await utilities.find('layout', 
		{org_key: org_key, year: event_year, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	// Process the cookies & (if selections defined) prepare to reduce
	var savedCols = {};
	var noneSelected = true;
	//colCookie = "a,b,ccc,d";
	
	// 2020-03-03, M.O'C: Read "default" columns from DB if none set - TODO could be cached
	if (!colCookie) {
		var thisOrg = await utilities.findOne('orgs', 
			{org_key: org_key}, {},
			{allowCache: true}
		);
		////logger.trace("thisOrg=" + JSON.stringify(thisOrg));
		var thisConfig = thisOrg.config;
		logger.trace('thisConfig=' + JSON.stringify(thisConfig));
		
		if (!thisConfig) {
			thisConfig = {};
			thisOrg['config'] = thisConfig;
		}
		var theseColDefaults = thisOrg.config.columnDefaults;
		if (!theseColDefaults) {
			theseColDefaults = {};
			thisOrg.config['columnDefaults'] = theseColDefaults;
		}

		logger.trace('theseColDefaults=' + JSON.stringify(theseColDefaults));
		var defaultSet = theseColDefaults[event_year];		
		logger.trace('defaultSet=' + defaultSet);

		if (defaultSet) {
			colCookie = defaultSet;
			//logger.trace('Using org default cookies=' + colCookie);
		}
	}
	
	if (colCookie) {
		logger.trace('colCookie=' + colCookie);
		noneSelected = false;
		var savedColArray = colCookie.split(',');
		for (var savedCol of savedColArray)
			savedCols[savedCol] = savedCol;
	}
	logger.trace('noneSelected=' + noneSelected + ',savedCols=' + JSON.stringify(savedCols));

	// Use the cookies (if defined, or if defaults set) to slim down the layout array
	if (noneSelected)
		scorelayout = scorelayoutDB;
	else {
		// Weed out unselected columns
		for (var thisLayout of scorelayoutDB) {
			//var thisLayout = scorelayoutDB[i];
			//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
			if (this.isQuantifiableType(thisLayout.type)) {
				if (savedCols[thisLayout.id]) 
					scorelayout.push(thisLayout);
			}
			else
				scorelayout.push(thisLayout);
		}
	}
    
	var retLength = -1;
	if (scorelayout)
		retLength = scorelayout.length;
	logger.info('EXIT returning ' + retLength);
	
	logger.removeContext('funcName');
	return scorelayout;
};

/**
 * Recalculates aggregated data ranges for org & event and stores in DB
 * @param {string} org_key Org key
 * @param {number} event_year Year of event
 * @param {string} event_key Event key
 */
matchDataHelper.calculateAndStoreAggRanges = async function(org_key, event_year, event_key) {
	logger.addContext('funcName', 'calculateAndStoreAggRanges');
	logger.info('ENTER org_key=' + org_key + ',event_year=' + event_year + ',event_key=' + event_key);

	var scorelayout = await utilities.find('layout', 
		{org_key: org_key, year: event_year, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	logger.trace('scorelayout=' + JSON.stringify(scorelayout));        
    
	var aggQuery = [];
	aggQuery.push({ $match : { 'org_key': org_key, 'event_key': event_key } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	var emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	var setWindowFieldsClause = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	var sortField = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	var outputClause = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (this.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause = {};
			let thisEMAinner = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause))
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	var groupClause = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (this.isQuantifiableType(thisLayout.type)) {
			//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + 'MIN'] = {$min: '$data.' + thisLayout.id};
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'}
			groupClause[thisLayout.id + 'VAR'] = {$stdDevSamp: '$data.' + thisLayout.id};
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	aggQuery.push({ $sort: { _id: 1 } });
	logger.trace('aggQuery=' + JSON.stringify(aggQuery));

	// Run the aggregation!
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggArray = await utilities.aggregate('matchscouting', aggQuery);
			
	var aggMinMaxArray = [];

	// Cycle through & build a map of min/max values per scoring type per aggregation
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
		if (this.isQuantifiableType(thisLayout.type)) {
			var thisMinMax = {};
			// 2020-02-08, M.O'C: Tweaking agg ranges
			// This data element is specifically for this organization & a specific event
			thisMinMax['org_key'] = org_key;
			thisMinMax['event_key'] = event_key;

			// initialize ranges
			var MINmin = 999999; var MINmax = 0; var AVGmin = 999999; var AVGmax = 0; var VARmin = 999999; var VARmax = 0; var MAXmin = 999999; var MAXmax = 0;
			// cycle through all the per-team aggregated data
			for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
				var thisAgg = aggArray[aggIdx];
				var roundedMinVal = parseFloat(thisAgg[thisLayout.id + 'MIN']);
				var roundedAvgVal = parseFloat(thisAgg[thisLayout.id + 'AVG']);
				var roundedVarVal = parseFloat(thisAgg[thisLayout.id + 'VAR']);
				var roundedMaxVal = parseFloat(thisAgg[thisLayout.id + 'MAX']);

				if (roundedMinVal < MINmin) MINmin = roundedMinVal; if (roundedMinVal > MINmax) MINmax = roundedMinVal;
				if (roundedAvgVal < AVGmin) AVGmin = roundedAvgVal; if (roundedAvgVal > AVGmax) AVGmax = roundedAvgVal;
				if (roundedVarVal < VARmin) VARmin = roundedVarVal; if (roundedVarVal > VARmax) VARmax = roundedVarVal;
				if (roundedMaxVal < MAXmin) MAXmin = roundedMaxVal; if (roundedMaxVal > MAXmax) MAXmax = roundedMaxVal;
			}
			
			// 2022-03-15 JL: While parsing the metrics into 1-decimal floats is completely unnecessary as they're just used for comparison, it looks nicer when checking things in the database.
			MINmin = parseFloat(MINmin.toFixed(1)); MINmax = parseFloat(MINmax.toFixed(1));
			AVGmin = parseFloat(AVGmin.toFixed(1)); AVGmax = parseFloat(AVGmax.toFixed(1));
			VARmin = parseFloat(VARmin.toFixed(1)); VARmax = parseFloat(VARmax.toFixed(1));
			MAXmin = parseFloat(MAXmin.toFixed(1)); MAXmax = parseFloat(MAXmax.toFixed(1));

			thisMinMax['key'] = thisLayout.key;
			thisMinMax['MINmin'] = MINmin; thisMinMax['MINmax'] = MINmax;
			thisMinMax['AVGmin'] = AVGmin; thisMinMax['AVGmax'] = AVGmax;
			thisMinMax['VARmin'] = VARmin; thisMinMax['VARmax'] = VARmax;
			thisMinMax['MAXmin'] = MAXmin; thisMinMax['MAXmax'] = MAXmax;

			logger.trace('thisMinMax=' + JSON.stringify(thisMinMax));

			aggMinMaxArray.push(thisMinMax);
		}
	}
	logger.trace('aggMinMaxArray=' + JSON.stringify(aggMinMaxArray));

	// 2020-02-08, M.O'C: Tweaking agg ranges
	// Delete the current agg ranges
	// await utilities.remove("currentaggranges", {});
	await utilities.remove('aggranges', {'org_key': org_key, 'event_key': event_key});
	// Reinsert the updated values
	// await utilities.insert("currentaggranges", aggMinMaxArray);
	await utilities.insert('aggranges', aggMinMaxArray);
    
	var inserted = -1;
	if (aggMinMaxArray)
		inserted = aggMinMaxArray.length;
	logger.info('EXIT org_key=' + org_key + ', inserted ' + inserted);
	
	logger.removeContext('funcName');
};

/**
 * Gets upcoming match data for a specified event (and team).
 * @param {string} event_key Event key.
 * @param {string} [team_key] Team key (can be 'all' or null)
 * @returns {MatchData} Data blob containing matches, teamRanks, team, and teamList
 */
matchDataHelper.getUpcomingMatchData = async function (event_key, team_key, org_key) {
	logger.addContext('funcName', 'getUpcomingMatchData');
	logger.info('ENTER event_key=' + event_key + ',team_key=' + team_key + ',org_key=' + org_key);
	//console.log('ENTER event_key=' + event_key + ',team_key=' + team_key + ',org_key=' + org_key);

	var returnData = new MatchData();

	var teamKey = team_key;
	if(!team_key)
		teamKey = 'all';

	//get our collections
	var teamRanks = {};
	
	//get list of teams for this event
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	var thisEvent = await utilities.findOne('events', 
		{'key': event_key}, {},
		{allowCache: true}
	);
	var teams = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0) {
		//logger.trace('thisEvent.team_keys=' + JSON.stringify(thisEvent.team_keys));
		teams = await utilities.find('teams', 
			{'key': {$in: thisEvent.team_keys}}, 
			{sort: {team_number: 1}},
			{allowCache: true}
		);
	}

	//get list of just team numbers
	var teamNumbers = [];
	for(let i in teams) {
		if (teams[i]) {
			teamNumbers[i] = teams[i].team_number;
		}
	}
	
	//get rankings for this event
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	var rankings = await utilities.find('rankings', 
		{'event_key': event_key}, 
		// {sort:{rank: 1}}
	);
	if(rankings)
		for(let i = 0; i < rankings.length; i++){
			var rankObj = rankings[i];
			var team = rankObj.team_key;
			
			teamRanks[team] = rankObj.rank;
			
		}
	
	returnData.teamRanks = teamRanks;
	returnData.teamNumbers = teamNumbers;
	
	const mostRecentScoredMatch = await utilities.findOne('matches', 
		{event_key: event_key, 'alliances.red.score': {$gte: 0}},
		{sort: {time: -1}},
		{allowCache: true}
	);
	
	var earliestTimestamp = 0;
	if (mostRecentScoredMatch) {
		earliestTimestamp = mostRecentScoredMatch.time;
	}
	
	var matches = [];
	if(teamKey != 'all'){
		
		//our query for matches collection
		var query = {
			$and: [
				{ event_key: event_key },
				{ 'alliances.red.score': -1 },
				{ time: {$gte: earliestTimestamp} },
				{
					$or: [
						{ 'alliances.blue.team_keys': teamKey },
						{ 'alliances.red.team_keys': teamKey },
					]
				}
			]
		};
		
		//find matches with our query
		matches = await utilities.find('matches', query, {sort: {time: 1}});

		returnData.matches = matches;
		returnData.team = teamKey;
	}
	//if teamKey is 'all'
	else {
		//find all matches for this event that have not been completed
		matches = await utilities.find('matches', {event_key: event_key, 'alliances.blue.score': -1, time: {$gte: earliestTimestamp}}, {sort: {time: 1}});

		returnData.matches = matches;
	}	
	
	// 2022-03-20, M.O'C: Adding in predictive statistics
	// 1. Get aggregation query; for each team, get Avg, StdDevSamp, and count of data points for 'contributedPoints'
	// 2. Iterate through the matches; for each one, for each alliance, get the data for each time for Avg and +/- StdDev
	// 2b. If at least one team has zero (0) available data, skip overall
	// 2c. Any team with 1 data point, reset StdDev to 1/2 of the one 'contributedPoints'
	// 3. Add the avgs & stddevs of the teams in each alliance for a combined avg & stddev
	// 4. Use those to calculate probability of one distribution over the other (z-table for lookup)

	// get aggregations for all teams
	var aggQuery = [];
	aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': org_key, 'event_key': event_key } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	var emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	var setWindowFieldsClause = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	var sortField = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	var outputClause = {};

	let thisEMAclause = {};
	let thisEMAinner = {};
	thisEMAinner['alpha'] = emaAlpha;
	thisEMAinner['input'] = '$data.contributedPoints';
	thisEMAclause['$expMovingAvg'] = thisEMAinner;
	outputClause['contributedPointsEMA'] = thisEMAclause;

	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause))
	aggQuery.push({$setWindowFields: setWindowFieldsClause});

	var groupClause = {};
	groupClause['_id'] = '$team_key';
	// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
	//groupClause['contributedPointsAVG'] = {$avg: '$data.contributedPoints'};
	groupClause['contributedPointsAVG'] = {$last: '$contributedPointsEMA'}
	groupClause['contributedPointsSTD'] = {$stdDevSamp: '$data.contributedPoints'};
	groupClause['dataCount'] = {$sum: 1};
	aggQuery.push({ $group: groupClause });

	//console.log('aggQuery=' + JSON.stringify(aggQuery));

	var aggFind = await utilities.aggregate('matchscouting', aggQuery);
	var aggDict = {};

	// initially assume there is going to be predictive capability
	returnData.hasPredictive = true;

	// TESTING! TODO REMOVE THIS vvv
	//aggFind.pop();  // kick off a team just so we have at least one team with zero (0) datapoints
	// TESTING! TODO REMOVE THIS ^^^
	for (var i = 0; i < aggFind.length; i++) {
		// if any team does NOT have a 'contributedPointsAVG' value, we're not going to show anything
		if (aggFind[i]['contributedPointsAVG'] == null) {
			returnData.hasPredictive = false;
		}
		else {
			// special case: normally StdDev of 1 point is zero (0); in our case, override to be 1/2 of the contributed points
			if (aggFind[i]['dataCount'] == 1)
				aggFind[i]['contributedPointsSTD'] = aggFind[i]['contributedPointsAVG'] / 2.0;
			aggDict[aggFind[i]['_id']] = aggFind[i];
		}
	}
	//console.log('aggDict=' + JSON.stringify(aggDict));
	//console.log('aggDict[frc102]=' + JSON.stringify(aggDict['frc102']))

	// go through the matches, get the alliances; update with predictive info
	for (let i = 0; i < returnData.matches.length; i++) {
		//console.log('blue=' + JSON.stringify(returnData.matches[i].alliances.blue.team_keys)
		//+ ',red=' + JSON.stringify(returnData.matches[i].alliances.red.team_keys));

		// need to put this flag on each match so that the mixin (which only sees the individual matches) can toggle
		returnData.matches[i].hasPredictive = returnData.hasPredictive;

		// set up the predictive values
		var predictiveBlock = {};
		var foundDataForEach = true;
		var blueAVG = 0; var blueSTD = 0; var blueCNT = 0;
		for (let j = 0; j < returnData.matches[i].alliances.blue.team_keys.length; j++) {
			let foundMatch = aggDict[returnData.matches[i].alliances.blue.team_keys[j]];
			if (foundMatch) {
				blueAVG += foundMatch['contributedPointsAVG'];
				blueSTD += foundMatch['contributedPointsSTD'];
				blueCNT += foundMatch['dataCount'];
			}
			else {
				foundDataForEach = false;
			}
		}
		var redAVG = 0; var redSTD = 0; var redCNT = 0;
		for (let j = 0; j < returnData.matches[i].alliances.red.team_keys.length; j++) {
			let foundMatch = aggDict[returnData.matches[i].alliances.red.team_keys[j]];
			if (foundMatch) {
				redAVG += foundMatch['contributedPointsAVG'];
				redSTD += foundMatch['contributedPointsSTD'];
				redCNT += foundMatch['dataCount'];
			}
			else {
				foundDataForEach = false;
			}
		}

		if (foundDataForEach) {
			var zscore = (redAVG - blueAVG) / Math.sqrt(redSTD*redSTD + blueSTD*blueSTD);
			if (!isNaN(zscore)) {
				var chanceOfRed = ztable(zscore); 
				//console.log('blueAVG=' + blueAVG + ',blueSTD=' + blueSTD + ',blueCNT=' + blueCNT + ',redAVG=' + redAVG + ',redSTD=' + redSTD + ',redCNT=' + redCNT + '...chanceOfRed=' + chanceOfRed);
				predictiveBlock['blueAVG'] = blueAVG; predictiveBlock['blueSTD'] = blueSTD;
				predictiveBlock['redAVG'] = redAVG; predictiveBlock['redSTD'] = redSTD;
				predictiveBlock['totalCNT'] = blueCNT + redCNT;
				predictiveBlock['chanceOfRed'] = chanceOfRed;
				logger.debug('match#=' + returnData.matches[i].match_number + ', predictiveBlock=' + JSON.stringify(predictiveBlock));
	
				returnData.matches[i]['predictive'] = predictiveBlock;
			}
			else {
				logger.warn(`Zscore is NaN! redAVG=${redAVG}, blueAVG=${blueAVG}, redSTD=${redSTD}, blueSTD=${blueSTD}, match_number=${returnData.matches[i].match_number}`);
			}
		}
		else {
			logger.debug('match#=' + returnData.matches[i].match_number + ' ... At least one zero data team');
		}
	}

	//console.log('returnData.matches=' + JSON.stringify(returnData.matches));

	logger.removeContext('funcName');
	return returnData;	
};

/**
 * Gets alliance stats
 * @param {string} event_year Event year
 * @param {string} event_key Event key
 * @param {string} org_key Org key
 * @param {string} teams_list Comma-separated list of teams, red alliance first, use ",0" between red list and blue list
 * @param {object} cookies req.cookies
 * @return {AllianceStatsData} Data blob containing teams, teamList, currentAggRanges, avgdata, maxdata
 */
matchDataHelper.getAllianceStatsData = async function ( event_year, event_key, org_key, teams_list, cookies ) {
	logger.addContext('funcName', 'getAllianceStatsData');
	
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key + ',org_key=' + org_key + ',teams_list=' + teams_list);
	var returnData = new AllianceStatsData();

	var teams = teams_list;

	var teamList = teams.split(',');
	//logger.trace('teamList=' + JSON.stringify(teamList));

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	var cookie_key = org_key + '_' + event_year + '_cols';
	var colCookie = cookies[cookie_key];
	var scorelayout = await this.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { 'team_key': {$in: teamList}, 'org_key': org_key, 'event_key': event_key } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	var emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	var setWindowFieldsClause = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	var sortField = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	var outputClause = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (this.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause = {};
			let thisEMAinner = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause))
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	var groupClause = {};
	// group by individual teams
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (this.isQuantifiableType(thisLayout.type)) {
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'}
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}

	aggQuery.push({ $group: groupClause });
	// logger.trace('aggQuery=' + JSON.stringify(aggQuery,0,2));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR = await utilities.aggregate('matchscouting', aggQuery);
	var aggresult = {};
	if (aggR)
		aggresult = aggR;
	logger.trace('aggresult=' + JSON.stringify(aggresult));

	// Build a map of the result rows by team key
	var aggRowsByTeam = {};
	for (var resultIdx = 0; resultIdx < aggresult.length; resultIdx++)
		aggRowsByTeam[ aggresult[resultIdx]['_id'] ] = aggresult[resultIdx];
	logger.trace( 'aggRowsByTeam[' + teamList[0] + ']=' + JSON.stringify(aggRowsByTeam[teamList[0]]) );

	// Unspool N rows of aggregate results into tabular form
	var avgTable = [];
	var maxTable = [];

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (this.isQuantifiableType(thisLayout.type)) {
			var avgRow = {};
			var maxRow = {};
			avgRow['key'] = thisLayout.id;
			maxRow['key'] = thisLayout.id;
			for (var teamIdx = 0; teamIdx < teamList.length; teamIdx++) {
				if (aggRowsByTeam[teamList[teamIdx]]) {
					avgRow[teamList[teamIdx]] = (Math.round(aggRowsByTeam[teamList[teamIdx]][thisLayout.id + 'AVG'] * 10)/10).toFixed(1);
					maxRow[teamList[teamIdx]] = (Math.round(aggRowsByTeam[teamList[teamIdx]][thisLayout.id + 'MAX'] * 10)/10).toFixed(1);
				}
			}
			avgTable.push(avgRow);
			maxTable.push(maxRow);
		}
	}
	logger.trace('avgTable=' + JSON.stringify(avgTable));
	logger.trace('maxTable=' + JSON.stringify(maxTable));

	//
	// Calculate the 'normalized' ranges
	//
	var avgNorms = [];
	for (let i in avgTable) {
		if (avgTable[i]) {
			let thisAvg = avgTable[i];
			////logger.trace("i=" + i + ",key=" + thisAvg.key);
			let min = 0; // 2022-03-18 JL: Making the norm calculations keep 0 as 0 so spider charts are more easy to understand
			let max = -9e9;
			let theseKeys = Object.keys(thisAvg);
			// Find the minimum & maximum from this range
			for (let j in theseKeys) {
				if (thisAvg.hasOwnProperty(theseKeys[j])) {
					let thisVal = thisAvg[theseKeys[j]];
					if (thisVal != thisAvg.key) {
						let numVal = parseFloat(thisVal);
						// if (numVal < min) min = numVal;
						if (numVal > max) max = numVal;
					}
				}
			}
			// Go through again & set values from 0 to 1, scaled by (val-min)/(max-min)
			let thisNorm = {};
			thisNorm.key = thisAvg.key;
			for (let j in theseKeys) {
				if (thisAvg.hasOwnProperty(theseKeys[j])) {
					let thisVal = thisAvg[theseKeys[j]];
					if (thisVal != thisAvg.key) {
						let numVal = parseFloat(thisVal);
						// Special case: If max == min then all values are Math.sign(Math.abs(max))
						let normVal = Math.sign(Math.abs(max));
						if (max != min) {
							normVal = (numVal - min) / (max - min);
							thisNorm[theseKeys[j]] = (Math.round(normVal * 10)/10).toFixed(1);
						}
					}
				}
			}
			avgNorms.push(thisNorm);
		}
	}
	// repeat but for maxTable
	var maxNorms = [];
	for (let i in maxTable) {
		if (maxTable[i]) {
			var thisMax = maxTable[i];
			////logger.trace("i=" + i + ",key=" + thisMax.key);
			let min = 0; // 2022-03-18 JL: Making the norm calculations keep 0 as 0 so spider charts are more easy to understand
			let max = -9e9;
			let theseKeys = Object.keys(thisMax);
			// Find the minimum & maximum from this range
			for (let j in theseKeys) {
				if (thisMax.hasOwnProperty(theseKeys[j])) {
					let thisVal = thisMax[theseKeys[j]];
					if (thisVal != thisMax.key) {
						let numVal = parseFloat(thisVal);
						// if (numVal < min) min = numVal;
						if (numVal > max) max = numVal;
					}
				}
			}
			// Go through again & set values from 0 to 1, scaled by (val-min)/(max-min)
			let thisNorm = {};
			thisNorm.key = thisMax.key;
			for (let j in theseKeys) {
				if (thisMax.hasOwnProperty(theseKeys[j])) {
					let thisVal = thisMax[theseKeys[j]];
					if (thisVal != thisMax.key) {
						let numVal = parseFloat(thisVal);
						// Special case: If max == min then all values are Math.sign(Math.abs(max))
						let normVal = Math.sign(Math.abs(max));
						if (max != min) {
							normVal = (numVal - min) / (max - min);
							thisNorm[theseKeys[j]] = (Math.round(normVal * 10)/10).toFixed(1);
						}
					}
				}
			}
			maxNorms.push(thisNorm);	
		}
	}
	logger.trace('avgNorms=' + JSON.stringify(avgNorms));
	logger.trace('maxNorms=' + JSON.stringify(maxNorms));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	var currentAggRanges = await utilities.find('aggranges', {'org_key': org_key, 'event_key': event_key});
	
	// set up the return data
	returnData.teams = teams;
	returnData.teamList = teamList;
	returnData.currentAggRanges = currentAggRanges;
	returnData.avgTable = avgTable;
	returnData.maxTable = maxTable;
	returnData.avgNorms = avgNorms;
	returnData.maxNorms = maxNorms;

	logger.removeContext('funcName');
	return returnData;	
};

class AllianceStatsData {
	/**
	 * Return of getAllianceStatsData
	 * @param {string} teams Comma-separated list
	 * @param {array} teamList Split version of teams
	 * @param {array} currentAggRanges currentAggRanges
	 * @param {array} avgdata avgTable
	 * @param {array} maxdata maxTable
	 * @param {array} avgNorms
	 * @param {array} maxNorms
	 */
	constructor(teams, teamList, currentAggRanges, avgdata, maxdata, avgNorms, maxNorms) {
		this.teams = teams;
		this.teamList = teamList;
		this.currentAggRanges = currentAggRanges;
		this.avgTable = avgdata;
		this.maxTable = maxdata;
		this.avgNorms = avgNorms;
		this.maxNorms = maxNorms;
	}
}

class MatchData{
	/**
	 * Return contents of getUpcomingMatchData
	 * @param {array} matches Matches
	 * @param {array} teamRanks Team ranks
	 * @param {string} team Team key
	 * @param {array} teamList Team numbers
	 */
	constructor(matches, teamRanks, team, teamList) {
		this.matches = matches;
		this.teamRanks = teamRanks;
		this.team = team;
		this.teamList = teamList;
	}
}