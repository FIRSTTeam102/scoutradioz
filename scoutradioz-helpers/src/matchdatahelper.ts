/* eslint-disable global-require */
'use strict';
import log4js from '@log4js-node/log4js-api';
import type { Utilities, MongoDocument } from 'scoutradioz-utilities';
import type { Match, Team, Ranking, TeamKey, AggRange, MatchFormData, formDataOutput, DerivedOperation, MultiplyOperation, SumOperation, SubtractOperation, DivideOperation, MultiselectOperation, ConditionOperation, CompareOperation, LogOperation, MinMaxOperation, AbsoluteValueOperation, DerivedLayout } from 'scoutradioz-types';
import assert from 'assert';

const logger = log4js.getLogger('helpers.matchData');
logger.level = process.env.LOG_LEVEL || 'debug';

let ztable = require('ztable');

let utilities: Utilities;

export class MatchDataHelper {
	
	/**
	 * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
	 * @param {Utilities} utilitiesModule 
	 */
	static config(utilitiesModule: Utilities) {
		utilities = utilitiesModule;
	}
	
	/**
	 * Returns whether a layout element type is quantifiable.
	 * @param {string} type Type of layout element
	 * @return {boolean} isQuantifiable
	 */
	static isQuantifiableType(type: string): boolean {
		
		let isQuantifiable;
		
		switch (type) {
			case 'checkbox':
			case 'counter':
			case 'counterallownegative':
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
	}
	
	/**
	 * Adjusts the data type of a given datum based on its layout type. Numerical elements are transformed into numbers, checkboxes are transformed into 0/1, and others are kept as strings.
	 * Use to "sanitize" the input from HTML forms into the database.
	 * @param {string|number} value The metric/datum to fix
	 * @param {string} type The type of the element, e.g. checkbox/counter/slider.
	 * @return {string|number} 
	 */
	static fixDatumType(value: string|number|boolean, type: string) {
	
		let newVal;
		
		// Note: Derived metrics are always returned as numbers (but this method should not be called for derived metrics)
		switch (type) {
			case 'checkbox': {
				if (value === 'true' || value === true) newVal = 1;
				else newVal = 0;
				break;
			}
			case 'counter':
			case 'counterallownegative':
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
	}
	
	/**
	 * Returns whether a layout element type is a metric.
	 * @param {string} type Type of layout element
	 * @return {boolean} isMetric
	 */
	static isMetric(type: string) {
		
		let isMetric;
		
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
	}
	
	/**
	 * Calculate derived metrics for a provided array of match data items.
	 * @param {string} org_key Org key
	 * @param {number} event_year Year of event
	 * @param {Object} matchData Scouting data ("data" field in the db)
	 * @returns {Object} matchData - Same object, not cloned, with the derived metrics added
	 */
	static async calculateDerivedMetrics(org_key: string, event_year: number, matchData: MatchFormData) {
		// let st = performance.now();
		// Just derived fields from the org's match scouting layout for this year
		let derivedLayout = await utilities.find('layout', 
			{org_key: org_key, year: event_year, form_type: 'matchscouting', type: 'derived'}, 
			{sort: {'order': 1}},
			{allowCache: true}
		) as DerivedLayout[];
		
		// let dt = performance.now();

		for (let i in derivedLayout) {
			const thisItem: DerivedLayout = derivedLayout[i];
			let derivedMetric: number|null = NaN;
			// JL - Note: I don't want to do any error checking in here, to minimize the amount of computation time needed.
			//	Error checking should be done at the time of creating the layout. (TODO: error checking :] )
			//	The very last operator must NOT have an "as", and every consequent operator should probably have an "as"
			
			let operations = thisItem.operations;
			let variables: NumericalDict = {};
			let length = operations.length;
			
			for (let i = 0; i < length; i++) {
				let thisOp = operations[i] as DerivedOperation;
				// let operands = thisOp.operands;
				switch (thisOp.operator) {
					// sum operands: [a, b, c, ...]
					case 'sum': case 'add': {
						let thisOp = operations[i] as SumOperation;
						let operands = thisOp.operands;
						
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
						let thisOp = operations[i] as MultiplyOperation;
						let operands = thisOp.operands;
						
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
						let thisOp = operations[i] as SubtractOperation;
						let operands = thisOp.operands;
						
						let minuendKey = operands[0];
						let subtrahendKey = operands[1];
						let difference: number;
						
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
						let thisOp = operations[i] as DivideOperation;
						let operands = thisOp.operands;
						
						let dividendKey = operands[0];
						let divisorKey = operands[1];
						let dividend: number, divisor: number, quotient: number;
						
						if (typeof dividendKey === 'number') dividend = dividendKey;
						else if (dividendKey.startsWith('$')) dividend = variables[dividendKey];
						else dividend = parseNumber(matchData[divisorKey]);
						
						if (typeof divisorKey === 'number') divisor = divisorKey;
						else if (divisorKey.startsWith('$')) divisor = variables[divisorKey];
						else divisor = parseNumber(matchData[divisorKey]);
						
						if (divisor === 0) quotient = 0; // Making divisions by 0 equal to 0 provides more helpful metrics, even if it doesn't make mathematical sense
						else quotient = dividend / divisor;
						
						if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = quotient;
						else derivedMetric = quotient;
						logger.trace(`Divide: ${quotient} -> ${thisOp.as || ''}`);
						break;
					}
					// Min / Max between two numbers
					// operands: [a, b] => max(a, b) or min(a, b)
					case 'min': case 'max': {
						let thisOp = operations[i] as MinMaxOperation;
						let operands = thisOp.operands;
						
						let aKey = operands[0];
						let bKey = operands[1];
						let a: number, b: number, result: number;
						
						if (typeof aKey === 'number') a = aKey;
						else if (aKey.startsWith('$')) a = variables[aKey];
						else a = parseNumber(matchData[aKey]);
						
						if (typeof bKey === 'number') b = bKey;
						else if (bKey.startsWith('$')) b = variables[bKey];
						else b = parseNumber(matchData[bKey]);
						
						if (thisOp.operator === 'min') result = Math.min(a, b);
						else result = Math.max(a, b);
						
						if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = result;
						else derivedMetric = result;
						logger.trace(`${thisOp.operator}: ${result} -> ${thisOp.as || ''}`);
						break;
					}
					// Log operands: [x, base] => log(x) / log(base)
					case 'log': {
						let thisOp = operations[i] as LogOperation;
						let operands = thisOp.operands;
						
						let inputKey = operands[0];
						let base = operands[1];
						let input: number, result: number;
						
						if (typeof inputKey === 'number') input = inputKey;
						else if (inputKey.startsWith('$')) input = variables[inputKey];
						else input = parseNumber(matchData[inputKey]);
						
						result = Math.log(input) / Math.log(base);
						
						if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = result;
						else derivedMetric = result;
						logger.trace(`${thisOp.operator}: ${result} -> ${thisOp.as || ''}`);
						break;
					}
					// abs operands: [a] => Math.abs(a)
					case 'abs': {
						let thisOp = operations[i] as AbsoluteValueOperation;
						let operands = thisOp.operands;
						
						let inputKey = operands[0];
						let input: number;
						
						if (typeof inputKey === 'number') input = inputKey;
						else if (inputKey.startsWith('$')) input = variables[inputKey];
						else input = parseNumber(matchData[inputKey]);
						
						let result = Math.abs(input);
						if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = result;
						else derivedMetric = result;
						logger.trace(`Log: ${result} -> ${thisOp.as || ''}`);
						break;
					}
					// multiselect quantifiers: {option1: value1, option2: value2, ...}; variables not supported
					case 'multiselect': {
						let thisOp = operations[i] as MultiselectOperation;
						
						// TODO: enforce that multiselect only applies to multiselect data type
						let key = matchData[thisOp.id]; 
						let value = parseNumber(thisOp.quantifiers[String(key)]);
						if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = value;
						else derivedMetric = value;
						logger.trace(`Multiselect: key=${key} ${value} -> ${thisOp.as || ''}`);
						break;
					}
					// condition operands: [boolean, valueIfTrue, valueIfFalse]
					case 'condition': {
						let thisOp = operations[i] as ConditionOperation;
						let operands = thisOp.operands;
						
						let conditionKey = operands[0];
						// ifTrue and ifFalse can either be a string (therefore being a variable/metric key) or a value, which can be either a number or explicitly null
						let ifTrueKey = operands[1]; 
						let ifFalseKey = operands[2];
						let condition, value;
						
						// Condition must be a variable or metric value, otherwise there's no reason to use this operation
						if (conditionKey.startsWith('$')) condition = parseBoolean(variables[conditionKey]);
						else condition = parseBoolean(matchData[conditionKey]);
						
						// 2022-04-10 JL: parseBoolean can never return a NaN
						// if (isNaN(condition)) {
						// 	value = NaN; // We must be cautious in the case where gt/gte/etc has NaN as a result
						// }
						// else 
						if (condition) {
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
						
						// 2022-04-10 JL: Don't allow intermediate conditions to output null; only final operations
						if (typeof thisOp.as === 'string') {
							if (value === null) variables['$' + thisOp.as] = 0;
							else variables['$' + thisOp.as] = value;
						}
						else derivedMetric = value;
						logger.trace(`Condition: ${condition}, true=${ifTrueKey} false=${ifFalseKey}, ${value} -> ${thisOp.as || ''}`);
						break;
					}
					// Comparison operations all act basically the same, except with a different operator, so we can share the same code
					//	Future note for building an error checking script: Make sure that the output of any of these operators is NOT used in sum, multiply, etc. Only in conditionals.
					//	operands ex: gt: [a, b] -> true if a > b, false if a <= b
					case 'gt': case 'gte': case 'lt': case 'lte': case 'eq': case 'ne': {
						let thisOp = operations[i] as CompareOperation;
						let operands = thisOp.operands;
						
						let aKey = operands[0];
						let bKey = operands[1];
						let a: number, b: number;
						let result: boolean;
						
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
							default: result = false;
						}
						// 2022-04-10 JL: For type consistency, all of these operations should output 1 or 0 instead of a boolean (even though we can do math on true & false)
						if (typeof thisOp.as === 'string') variables['$' + thisOp.as] = result ? 1 : 0;
						else derivedMetric = result ? 1 : 0; 
						logger.trace(`${thisOp.operator}: a=${aKey}->${a}, b=${bKey}->${b}; ${result} -> ${thisOp.as || ''}`);
						break;
					}
				}
			}
			logger.trace(`Final metric: ${derivedMetric} - Label: ${thisItem.label} / ${thisItem.id}`);
			// Insert the newly derived metric into 
			matchData[thisItem.id] = derivedMetric;
		}
		
		function parseBoolean(item: formDataOutput): boolean {
			if (item === 'false') return false;
			else return !!item;
		}
		
		// Turns checkboxes into 0 and 1
		function parseNumber(item: formDataOutput): number {
			if (item === 'true' || item === true) return 1;
			else if (item === 'false' || item === false) return 0;
			else return parseFloat(item);
		}
		// logger.trace(`${dt - st}, ${performance.now() - dt}`);
		
		return matchData;
	}
	
	/**
	 * @param {string} org_key Org key
	 * @param {number} event_year Year of event
	 * @param {string} colCookie Comma-separated list of metric IDs
	 * @return {array} Modified (reduce) match scouting layout, from the list in colCookie
	 */
	static async getModifiedMatchScoutingLayout(org_key: string, event_year: number, colCookie: string) {
		logger.addContext('funcName', 'getModifiedMatchScoutingLayout');
		logger.info('ENTER org_key=' + org_key + ',event_year=' + event_year + ',colCookie=' + colCookie);
		
		if (!utilities) {
			throw new Error('Utilities has not been configured!');
		}
		
		// create the return array
		let scorelayout: MongoDocument[] = [];

		// read in the layout as stored in the DB
		let scorelayoutDB = await utilities.find('layout', 
			{org_key: org_key, year: event_year, form_type: 'matchscouting'}, 
			{sort: {'order': 1}},
			{allowCache: true}
		);

		// Process the cookies & (if selections defined) prepare to reduce
		let savedCols: StringDict = {};
		let noneSelected = true;
		//colCookie = "a,b,ccc,d";
		
		// 2020-03-03, M.O'C: Read "default" columns from DB if none set - TODO could be cached
		if (!colCookie) {
			let thisOrg = await utilities.findOne('orgs', 
				{org_key: org_key}, {},
				{allowCache: true}
			);
			////logger.trace("thisOrg=" + JSON.stringify(thisOrg));
			let thisConfig = thisOrg.config;
			logger.trace('thisConfig=' + JSON.stringify(thisConfig));
			
			assert(thisConfig, 'Org has no config!'); // 2023-02-14 JL: Changed if (!thisConfig) thisConfig = {}; to an assert b/c orgs should always have a config
			let theseColDefaults = thisOrg.config.columnDefaults;
			if (!theseColDefaults) {
				theseColDefaults = {};
				thisOrg.config['columnDefaults'] = theseColDefaults;
			}

			logger.trace('theseColDefaults=' + JSON.stringify(theseColDefaults));
			let defaultSet = theseColDefaults[event_year];		
			logger.trace('defaultSet=' + defaultSet);

			if (defaultSet) {
				colCookie = defaultSet;
				//logger.trace('Using org default cookies=' + colCookie);
			}
		}
		
		if (colCookie) {
			logger.trace('colCookie=' + colCookie);
			noneSelected = false;
			let savedColArray = colCookie.split(',');
			for (let savedCol of savedColArray)
				savedCols[savedCol] = savedCol;
		}
		logger.trace('noneSelected=' + noneSelected + ',savedCols=' + JSON.stringify(savedCols));

		// Use the cookies (if defined, or if defaults set) to slim down the layout array
		if (noneSelected)
			scorelayout = scorelayoutDB;
		else {
			// Weed out unselected columns
			for (let thisLayout of scorelayoutDB) {
				//var thisLayout = scorelayoutDB[i];
				if (this.isQuantifiableType(thisLayout.type)) {
					assert(thisLayout.id, `Layout element has no ID: ${JSON.stringify(thisLayout)}`);
					if (savedCols[thisLayout.id]) 
						scorelayout.push(thisLayout);
				}
				else
					scorelayout.push(thisLayout);
			}
		}
		
		let retLength = -1;
		if (scorelayout)
			retLength = scorelayout.length;
		logger.info('EXIT returning ' + retLength);
		
		logger.removeContext('funcName');
		return scorelayout;
	}

	/**
	 * Recalculates aggregated data ranges for org & event and stores in DB
	 * @param {string} org_key Org key
	 * @param {number} event_year Year of event
	 * @param {string} event_key Event key
	 */
	static async calculateAndStoreAggRanges(org_key: string, event_year: number, event_key: string) {
		logger.addContext('funcName', 'calculateAndStoreAggRanges');
		logger.info('ENTER org_key=' + org_key + ',event_year=' + event_year + ',event_key=' + event_key);
	
		let scorelayout = await utilities.find('layout', 
			{org_key: org_key, year: event_year, form_type: 'matchscouting'}, 
			{sort: {'order': 1}},
			{allowCache: true}
		);
		logger.trace('scorelayout=' + JSON.stringify(scorelayout));        
		
		let aggQuery: MongoDocument[] = [];
		aggQuery.push({ $match : { 'org_key': org_key, 'event_key': event_key } });
	
		// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
		//get the alpha from the process.env
		let emaAlpha = parseFloat(process.env.EMA_ALPHA);
		//initialize setWindowFieldsClause
		let setWindowFieldsClause: MongoDocument = {};
		setWindowFieldsClause['partitionBy'] = '$team_key';
		let sortField: MongoDocument = {};
		sortField['time'] = 1;
		setWindowFieldsClause['sortBy'] = sortField;
		let outputClause: MongoDocument = {};
		//iterate through scoringlayout
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			//pull this layout element from score layout
			let thisLayout = scorelayout[scoreIdx];
			// thisLayout.key = thisLayout.id; // 2023-02-14 JL: Changed thisLayout.key back to thisLayout.id because thisLayout.key was already set to thisLayout.id anyways
			scorelayout[scoreIdx] = thisLayout;
			//if it is a valid data type, add this layout's ID to groupClause
			if (this.isQuantifiableType(thisLayout.type)) {
				let thisEMAclause: MongoDocument = {};
				let thisEMAinner: MongoDocument = {};
				thisEMAinner['alpha'] = emaAlpha;
				thisEMAinner['input'] = '$data.' + thisLayout.id;
				thisEMAclause['$expMovingAvg'] = thisEMAinner;
				outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
			}
		}
		setWindowFieldsClause['output'] = outputClause;
		logger.trace('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
		aggQuery.push({$setWindowFields: setWindowFieldsClause});
		
		let groupClause: MongoDocument = {};
		groupClause['_id'] = '$team_key';
	
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			let thisLayout = scorelayout[scoreIdx];
			if (this.isQuantifiableType(thisLayout.type)) {
				//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
				groupClause[thisLayout.id + 'MIN'] = {$min: '$data.' + thisLayout.id};
				// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
				//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
				groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
				groupClause[thisLayout.id + 'VAR'] = {$stdDevSamp: '$data.' + thisLayout.id};
				groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
			}
		}
		aggQuery.push({ $group: groupClause });
		aggQuery.push({ $sort: { _id: 1 } });
		logger.trace('aggQuery=' + JSON.stringify(aggQuery));
	
		// Run the aggregation!
		// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
		let aggArray: MongoDocument[] = await utilities.aggregate('matchscouting', aggQuery);
				
		let aggMinMaxArray: AggRange[] = [];
	
		// Cycle through & build a map of min/max values per scoring type per aggregation
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			let thisLayout = scorelayout[scoreIdx];
			if (this.isQuantifiableType(thisLayout.type)) {
				// let thisMinMax: MongoDocument = {};
				// 2020-02-08, M.O'C: Tweaking agg ranges
				// This data element is specifically for this organization & a specific event
				// thisMinMax['org_key'] = org_key;
				// thisMinMax['event_key'] = event_key;
	
				// initialize ranges
				let MINmin = 999999; let MINmax = 0; let AVGmin = 999999; let AVGmax = 0; let VARmin = 999999; let VARmax = 0; let MAXmin = 999999; let MAXmax = 0;
				// cycle through all the per-team aggregated data
				for (let aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
					let thisAgg = aggArray[aggIdx];
					let roundedMinVal = parseFloat(thisAgg[thisLayout.id + 'MIN']);
					let roundedAvgVal = parseFloat(thisAgg[thisLayout.id + 'AVG']);
					let roundedVarVal = parseFloat(thisAgg[thisLayout.id + 'VAR']);
					let roundedMaxVal = parseFloat(thisAgg[thisLayout.id + 'MAX']);
	
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
	
				// thisMinMax['key'] = thisLayout.id; // 2023-02-14 JL: Changed thisLayout.key back to thisLayout.id because thisLayout.key was already set to thisLayout.id anyways
				// thisMinMax['MINmin'] = MINmin; thisMinMax['MINmax'] = MINmax;
				// thisMinMax['AVGmin'] = AVGmin; thisMinMax['AVGmax'] = AVGmax;
				// thisMinMax['VARmin'] = VARmin; thisMinMax['VARmax'] = VARmax;
				// thisMinMax['MAXmin'] = MAXmin; thisMinMax['MAXmax'] = MAXmax;
				
				assert(thisLayout.id, `Layout element does not have an ID!!! ${JSON.stringify(thisLayout)}`);
				
				// 2023-02-14 JL: Switched to creating the object all at once, to make TypeScript happy
				let thisMinMax: AggRange = {
					org_key,
					event_key,
					key: thisLayout.id,
					MINmin, MINmax,
					AVGmin, AVGmax,
					VARmin, VARmax,
					MAXmin, MAXmax
				};
	
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
		
		let inserted = -1;
		if (aggMinMaxArray)
			inserted = aggMinMaxArray.length;
		logger.info('EXIT org_key=' + org_key + ', inserted ' + inserted);
		
		logger.removeContext('funcName');
	}

	/**
	 * Gets upcoming match data for a specified event (and team).
	 * @param {string} event_key Event key.
	 * @param {string} [team_key] Team key (can be 'all' or null)
	 * @returns {MatchData} Data blob containing matches, teamRanks, team, and teamList
	 */
	static async getUpcomingMatchData(event_key: string, team_key: string, org_key: string) {
		logger.addContext('funcName', 'getUpcomingMatchData');
		logger.info('ENTER event_key=' + event_key + ',team_key=' + team_key + ',org_key=' + org_key);
		//console.log('ENTER event_key=' + event_key + ',team_key=' + team_key + ',org_key=' + org_key);
	
		let returnData: UpcomingMatchData;
	
		let teamKey = team_key;
		if(!team_key)
			teamKey = 'all';
	
		//get our collections
		let teamRanks: NumericalDict = {};
		
		//get list of teams for this event
		// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
		let thisEvent = await utilities.findOne('events', 
			{'key': event_key}, {},
			{allowCache: true}
		);
		let teams: Team[] = [];
		if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0) {
			//logger.trace('thisEvent.team_keys=' + JSON.stringify(thisEvent.team_keys));
			teams = await utilities.find('teams', 
				{'key': {$in: thisEvent.team_keys}}, 
				{sort: {team_number: 1}},
				{allowCache: true}
			);
		}
	
		//get list of just team numbers TODO: this method feels pretty janky -JL
		let teamNumbers: number[] = [];
		for(let i in teams) {
			if (teams[i]) {
				teamNumbers[i] = teams[i].team_number;
			}
		}
		
		//get rankings for this event
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
		let rankings: Ranking[] = await utilities.find('rankings', 
			{'event_key': event_key}, 
			// {sort:{rank: 1}}
		);
		if(rankings)
			for(let i = 0; i < rankings.length; i++){
				let rankObj = rankings[i];
				let team = rankObj.team_key;
				
				teamRanks[team] = rankObj.rank;
				
			}
		
		const mostRecentScoredMatch = await utilities.findOne('matches', 
			{event_key: event_key, 'alliances.red.score': {$gte: 0}},
			{sort: {time: -1}},
			{allowCache: true}
		);
		
		let earliestTimestamp = 0;
		if (mostRecentScoredMatch) {
			earliestTimestamp = mostRecentScoredMatch.time;
		}
		
		let matches: Match[] = [];
		if(teamKey != 'all'){
			
			//our query for matches collection
			let query = {
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
		}
		//if teamKey is 'all'
		else {
			//find all matches for this event that have not been completed
			matches = await utilities.find('matches', {event_key: event_key, 'alliances.blue.score': -1, time: {$gte: earliestTimestamp}}, {sort: {time: 1}});
		}
		
		returnData = {
			teamRanks: teamRanks,
			teamNumbers: teamNumbers,
			matches: matches,
		};
		
		if (teamKey !== 'all') returnData.team = teamKey;
		
		// 2022-03-20, M.O'C: Adding in predictive statistics
		// 1. Get aggregation query; for each team, get Avg, StdDevSamp, and count of data points for 'contributedPoints'
		// 2. Iterate through the matches; for each one, for each alliance, get the data for each time for Avg and +/- StdDev
		// 2b. If at least one team has zero (0) available data, skip overall
		// 2c. Any team with 1 data point, reset StdDev to 1/2 of the one 'contributedPoints'
		// 3. Add the avgs & stddevs of the teams in each alliance for a combined avg & stddev
		// 4. Use those to calculate probability of one distribution over the other (z-table for lookup)
	
		// get aggregations for all teams
		let aggQuery: MongoDocument[] = [];
		aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': org_key, 'event_key': event_key } });
	
		// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
		//get the alpha from the process.env
		let emaAlpha = parseFloat(process.env.EMA_ALPHA);
		//initialize setWindowFieldsClause
		let setWindowFieldsClause: MongoDocument = {};
		setWindowFieldsClause['partitionBy'] = '$team_key';
		let sortField: MongoDocument = {};
		sortField['time'] = 1;
		setWindowFieldsClause['sortBy'] = sortField;
		let outputClause: MongoDocument = {};
	
		let thisEMAclause: MongoDocument = {};
		let thisEMAinner: MongoDocument = {};
		thisEMAinner['alpha'] = emaAlpha;
		thisEMAinner['input'] = '$data.contributedPoints';
		thisEMAclause['$expMovingAvg'] = thisEMAinner;
		outputClause['contributedPointsEMA'] = thisEMAclause;
	
		setWindowFieldsClause['output'] = outputClause;
		logger.trace('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
		aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
		let groupClause: MongoDocument = {};
		groupClause['_id'] = '$team_key';
		// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
		//groupClause['contributedPointsAVG'] = {$avg: '$data.contributedPoints'};
		groupClause['contributedPointsAVG'] = {$last: '$contributedPointsEMA'};
		groupClause['contributedPointsSTD'] = {$stdDevSamp: '$data.contributedPoints'};
		groupClause['dataCount'] = {$sum: 1};
		aggQuery.push({ $group: groupClause });
	
		//console.log('aggQuery=' + JSON.stringify(aggQuery));
	
		let aggFind: MongoDocument[] = await utilities.aggregate('matchscouting', aggQuery);
		let aggDict: MongoDocument = {};
	
		// initially assume there is going to be predictive capability
		returnData.hasPredictive = true;
	
		// TESTING! TODO REMOVE THIS vvv
		//aggFind.pop();  // kick off a team just so we have at least one team with zero (0) datapoints
		// TESTING! TODO REMOVE THIS ^^^
		for (let i = 0; i < aggFind.length; i++) {
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
			let predictiveBlock: PredictiveBlock = {};
			let foundDataForEach = true;
			let blueAVG = 0; let blueSTD = 0; let blueCNT = 0;
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
			let redAVG = 0; let redSTD = 0; let redCNT = 0;
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
				let zscore = (redAVG - blueAVG) / Math.sqrt(redSTD*redSTD + blueSTD*blueSTD);
				if (!isNaN(zscore)) {
					let chanceOfRed = ztable(zscore); 
					//console.log('blueAVG=' + blueAVG + ',blueSTD=' + blueSTD + ',blueCNT=' + blueCNT + ',redAVG=' + redAVG + ',redSTD=' + redSTD + ',redCNT=' + redCNT + '...chanceOfRed=' + chanceOfRed);
					predictiveBlock['blueAVG'] = blueAVG; predictiveBlock['blueSTD'] = blueSTD;
					predictiveBlock['redAVG'] = redAVG; predictiveBlock['redSTD'] = redSTD;
					predictiveBlock['totalCNT'] = blueCNT + redCNT;
					predictiveBlock['chanceOfRed'] = chanceOfRed;
					logger.trace('match#=' + returnData.matches[i].match_number + ', predictiveBlock=' + JSON.stringify(predictiveBlock));
		
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
	}

	/**
	 * Gets alliance stats
	 * @param {number} event_year Event year
	 * @param {string} event_key Event key
	 * @param {string} org_key Org key
	 * @param {string} teams_list Comma-separated list of teams, red alliance first, use ",0" between red list and blue list
	 * @param {object} cookies req.cookies
	 * @return {AllianceStatsData} Data blob containing teams, teamList, currentAggRanges, avgdata, maxdata
	 */
	static async getAllianceStatsData( event_year: number, event_key: string, org_key: string, teams_list: string, cookies: any ) {
		logger.addContext('funcName', 'getAllianceStatsData');
		
		logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key + ',org_key=' + org_key + ',teams_list=' + teams_list);
	
		let teams = teams_list;
	
		let teamList = teams.split(',');
		//logger.trace('teamList=' + JSON.stringify(teamList));
	
		// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
		let cookie_key = org_key + '_' + event_year + '_cols';
		let colCookie = cookies[cookie_key];
		let scorelayout = await this.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	
		let aggQuery: MongoDocument[] = [];
		aggQuery.push({ $match : { 'team_key': {$in: teamList}, 'org_key': org_key, 'event_key': event_key } });
	
		// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
		//get the alpha from the process.env
		let emaAlpha = parseFloat(process.env.EMA_ALPHA);
		//initialize setWindowFieldsClause
		let setWindowFieldsClause: MongoDocument = {};
		setWindowFieldsClause['partitionBy'] = '$team_key';
		let sortField: MongoDocument = {};
		sortField['time'] = 1;
		setWindowFieldsClause['sortBy'] = sortField;
		let outputClause: MongoDocument = {};
		//iterate through scoringlayout
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			//pull this layout element from score layout
			let thisLayout = scorelayout[scoreIdx];
			thisLayout.key = thisLayout.id;
			scorelayout[scoreIdx] = thisLayout;
			//if it is a valid data type, add this layout's ID to groupClause
			if (this.isQuantifiableType(thisLayout.type)) {
				let thisEMAclause: MongoDocument = {};
				let thisEMAinner: MongoDocument = {};
				thisEMAinner['alpha'] = emaAlpha;
				thisEMAinner['input'] = '$data.' + thisLayout.id;
				thisEMAclause['$expMovingAvg'] = thisEMAinner;
				outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
			}
		}
		setWindowFieldsClause['output'] = outputClause;
		logger.trace('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
		aggQuery.push({$setWindowFields: setWindowFieldsClause});
		
		let groupClause: MongoDocument = {};
		// group by individual teams
		groupClause['_id'] = '$team_key';
	
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			let thisLayout = scorelayout[scoreIdx];
			if (this.isQuantifiableType(thisLayout.type)) {
				// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
				//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
				groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
				groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
			}
		}
	
		aggQuery.push({ $group: groupClause });
		logger.debug('aggQuery=', aggQuery);
	
		// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
		let aggR = await utilities.aggregate('matchscouting', aggQuery);
		let aggresult: MongoDocument = {};
		if (aggR)
			aggresult = aggR;
		logger.trace('aggresult=' + JSON.stringify(aggresult));
	
		// Build a map of the result rows by team key
		let aggRowsByTeam: MongoDocument = {};
		for (let resultIdx = 0; resultIdx < aggresult.length; resultIdx++)
			aggRowsByTeam[ aggresult[resultIdx]['_id'] ] = aggresult[resultIdx];
		logger.trace( 'aggRowsByTeam[' + teamList[0] + ']=' + JSON.stringify(aggRowsByTeam[teamList[0]]) );
	
		// Unspool N rows of aggregate results into tabular form
		let avgTable: MetricRow[] = [];
		let maxTable: MetricRow[] = [];
	
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			let thisLayout = scorelayout[scoreIdx];
			if (this.isQuantifiableType(thisLayout.type)) {
				let avgRow: MetricRow = {
					key: thisLayout.id
				};
				let maxRow: MetricRow = {
					key: thisLayout.id
				};
				for (let teamIdx = 0; teamIdx < teamList.length; teamIdx++) {
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
		let avgNorms: MetricRow[] = [];
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
				let thisNorm: MetricRow = {
					key: thisAvg.key
				};
				for (let j in theseKeys) {
					if (thisAvg.hasOwnProperty(theseKeys[j])) {
						let thisVal = thisAvg[theseKeys[j]];
						if (thisVal != thisAvg.key) {
							let numVal = parseFloat(thisVal);
							// Special case: If max == min then all values are Math.sign(Math.abs(max))
							let normVal = Math.sign(Math.abs(max));
							if (max != min) {
								normVal = (numVal - min) / (max - min);
							}
							thisNorm[theseKeys[j]] = (normVal).toFixed(1);
						}
					}
				}
				avgNorms.push(thisNorm);
			}
		}
		// repeat but for maxTable
		let maxNorms: MetricRow[] = [];
		for (let i in maxTable) {
			if (maxTable[i]) {
				let thisMax = maxTable[i];
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
				let thisNorm: MetricRow = {
					key: thisMax.key
				};
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
		let currentAggRanges = await utilities.find('aggranges', {'org_key': org_key, 'event_key': event_key});
		
		// set up the return data
		let returnData: AllianceStatsData = {
			teams, 
			teamList, 
			currentAggRanges, 
			avgTable, 
			maxTable, 
			avgNorms, 
			maxNorms
		};
		logger.removeContext('funcName');
		return returnData;	
	}
}

module.exports = MatchDataHelper;
export default MatchDataHelper;

// parseInt in reality can accept any type.
declare function parseInt(value: string|number|boolean|undefined|null): number;
declare function parseFloat(value: string|number|boolean|undefined|null): number;


export declare interface AllianceStatsData {
	/**
	 * Return of getAllianceStatsData
	 * @param {string} teams Comma-separated list
	 * @param {array} teamList Split version of teams
	 * @param {array} currentAggRanges currentAggRanges
	 * @param {array} avgTable avgTable
	 * @param {array} maxTable maxTable
	 * @param {array} avgNorms
	 * @param {array} maxNorms
	 */
	teams: string;
	teamList: string[];
	currentAggRanges: AggRange[]; // TODO
	avgTable: MetricRow[]; // TODO
	maxTable: MetricRow[]; // you get the picture
	avgNorms: MetricRow[];
	maxNorms: MetricRow[];
}

export declare interface MetricRow {
	key: string;
	[team_key: TeamKey]: string;
}

export declare interface UpcomingMatchData {
	matches: UpcomingMatch[];
	teamRanks: {
		[team_key: string]: number;
	};
	team?: TeamKey;
	teamNumbers: number[];
	hasPredictive?: boolean;
	// predictive?: PredictiveBlock; 2023-12-13 JL: UpcomingMatchData.predictive is not used
}

/**
 * FRC Match with optional predictive stuff added
 */
export declare interface UpcomingMatch extends Match {
	hasPredictive?: boolean;
	predictive?: PredictiveBlock;
}

export declare interface PredictiveBlock {
	blueAVG?: number;
	blueSTD?: number;
	redAVG?: number;
	redSTD?: number;
	totalCNT?: number;
	chanceOfRed?: number;
}

declare interface NumericalDict {
	[key: string]: number;
}

declare interface StringDict {
	[key: string]: string;
}