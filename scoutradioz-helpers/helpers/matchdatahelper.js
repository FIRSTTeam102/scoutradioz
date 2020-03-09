'use strict';
const logger = require('@log4js-node/log4js-api').getLogger('helpers');
const utilities = require("@firstteam102/scoutradioz-utilities");

var matchDataHelper = module.exports = {};

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
			isQuantifiable = true;
			break;
		default:
			isQuantifiable = false;
	}
	
	return isQuantifiable;
}

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
}

/**
 * @param {string} org_key Org key
 * @param {number} event_year Year of event
 * @param {string} colCookie Comma-separated list of metric IDs
 * @return {array} Modified (reduce) match scouting layout, from the list in colCookie
 */
matchDataHelper.getModifiedMatchScoutingLayout = async function(org_key, event_year, colCookie) {
	var thisFuncName = "matchdatahelper.getModifiedMatchScoutingLayout: ";
    logger.info(thisFuncName + 'ENTER org_key=' + org_key + ',event_year=' + event_year + ',colCookie=' + colCookie);
    
    // create the return array
    var scorelayout = [];

    // read in the layout as stored in the DB
	var scorelayoutDB = await utilities.find("layout", 
		{org_key: org_key, year: event_year, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);

    // Process the cookies & (if selections defined) prepare to reduce
	var savedCols = {};
	var noneSelected = true;
	//colCookie = "a,b,ccc,d";

	// 2020-03-03, M.O'C: Read "default" columns from DB if none set - TODO could be cached
	if (!colCookie) {
		var thisOrg = await utilities.findOne("orgs", 
			{org_key: org_key}, {},
			{allowCache: true}
		);
		//logger.debug(thisFuncName + "thisOrg=" + JSON.stringify(thisOrg));
		var thisConfig = thisOrg.config;
		//logger.debug(thisFuncName + "thisConfig=" + JSON.stringify(thisConfig));
		if (!thisConfig) {
			thisConfig = {};
			thisOrg['config'] = thisConfig;
		}
		var theseColDefaults = thisOrg.config.columnDefaults;
		if (!theseColDefaults) {
			theseColDefaults = {};
			thisOrg.config['columnDefaults'] = theseColDefaults;
		}

		//logger.debug(thisFuncName + "theseColDefaults=" + JSON.stringify(theseColDefaults));
		var defaultSet = theseColDefaults[event_year];		
		//logger.debug(thisFuncName + "defaultSet=" + defaultSet);

		if (defaultSet) {
			colCookie = defaultSet;
			logger.debug(thisFuncName + "Using org default cookies=" + colCookie);
		}
	}
	
	if (colCookie) {
		//logger.debug(thisFuncName + "colCookie=" + colCookie);
		noneSelected = false;
		var savedColArray = colCookie.split(",");
		for (var i in savedColArray)
			savedCols[savedColArray[i]] = savedColArray[i];
	}
	//logger.debug(thisFuncName + "noneSelected=" + noneSelected + ",savedCols=" + JSON.stringify(savedCols));

	// Use the cookies (if defined, or if defaults set) to slim down the layout array
	if (noneSelected)
		scorelayout = scorelayoutDB;
	else {
		// Weed out unselected columns
		for (var i in scorelayoutDB) {
			var thisLayout = scorelayoutDB[i];
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
	logger.info(thisFuncName + 'EXIT returning ' + retLength);
    return scorelayout;
}

/**
 * Recalculates aggregated data ranges for org & event and stores in DB
 * @param {string} org_key Org key
 * @param {number} event_year Year of event
 * @param {string} event_key Event key
 */
matchDataHelper.calculateAndStoreAggRanges = async function(org_key, event_year, event_key) {
	var thisFuncName = "matchdatahelper.calculateAndStoreAggRanges: ";
	logger.info(thisFuncName + 'ENTER org_key=' + org_key + ',event_year=' + event_year + ',event_key=' + event_key);

	var scorelayout = await utilities.find("layout", 
		{org_key: org_key, year: event_year, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);
    //logger.debug(thisFuncName + "scorelayout=" + JSON.stringify(scorelayout));        
    
	var aggQuery = [];
	aggQuery.push({ $match : { "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group teams for 1 row per team
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
        //if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
		if (this.isQuantifiableType(thisLayout.type)) {
			groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	aggQuery.push({ $sort: { _id: 1 } });
	logger.trace(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// Run the aggregation!
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggArray = await utilities.aggregate("matchscouting", aggQuery);
			
	var aggMinMaxArray = [];

	// Cycle through & build a map of min/max values per scoring type per aggregation
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
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
				var roundedMinVal = (Math.round(thisAgg[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
				var roundedAvgVal = (Math.round(thisAgg[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
				var roundedVarVal = (Math.round(thisAgg[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
				var roundedMaxVal = (Math.round(thisAgg[thisLayout.id + "MAX"] * 10)/10).toFixed(1);

				if (roundedMinVal < MINmin) MINmin = roundedMinVal; if (roundedMinVal > MINmax) MINmax = roundedMinVal; 
				if (roundedAvgVal < AVGmin) AVGmin = roundedAvgVal; if (roundedAvgVal > AVGmax) AVGmax = roundedAvgVal; 
				if (roundedVarVal < VARmin) VARmin = roundedVarVal; if (roundedVarVal > VARmax) VARmax = roundedVarVal; 
				if (roundedMaxVal < MAXmin) MAXmin = roundedMaxVal; if (roundedMaxVal > MAXmax) MAXmax = roundedMaxVal; 
			}

			thisMinMax['key'] = thisLayout.key;
			thisMinMax['MINmin'] = MINmin; thisMinMax['MINmax'] = MINmax;
			thisMinMax['AVGmin'] = AVGmin; thisMinMax['AVGmax'] = AVGmax;
			thisMinMax['VARmin'] = VARmin; thisMinMax['VARmax'] = VARmax;
			thisMinMax['MAXmin'] = MAXmin; thisMinMax['MAXmax'] = MAXmax;

			logger.trace(thisFuncName + 'thisMinMax=' + JSON.stringify(thisMinMax));

			aggMinMaxArray.push(thisMinMax);
		}
	}
	logger.trace(thisFuncName + 'aggMinMaxArray=' + JSON.stringify(aggMinMaxArray));

	// 2020-02-08, M.O'C: Tweaking agg ranges
	// Delete the current agg ranges
	// await utilities.remove("currentaggranges", {});
	await utilities.remove("aggranges", {"org_key": org_key, "event_key": event_key});
	// Reinsert the updated values
	// await utilities.insert("currentaggranges", aggMinMaxArray);
    await utilities.insert("aggranges", aggMinMaxArray);
    
    var inserted = -1;
    if (aggMinMaxArray)
        inserted = aggMinMaxArray.length;
	logger.info(thisFuncName + 'EXIT org_key=' + org_key + ', inserted ' + inserted);
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

/**
 * Gets upcoming match data for a specified event (and team).
 * @param {string} event_key Event key.
 * @param {string} [team_key] Team key (can be 'all' or null)
 * @returns {MatchData} Data blob containing matches, teamRanks, team, and teamList
 */
matchDataHelper.getUpcomingMatchData = async function (event_key, team_key) {
	
	var thisFuncName = "reports.getUpcomingMatchData(): ";
	logger.info(thisFuncName + 'ENTER event_key=' + event_key + ',team_key=' + team_key);
	var returnData = new MatchData(null, null, null, null);

	var teamKey = team_key;
	if(!team_key)
		teamKey = 'all';

	//get our collections
	var teamRanks = {};
	
	//get list of teams for this event
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	var thisEvent = await utilities.findOne("events", 
		{"key": event_key}, {},
		{allowCache: true}
	);
	var teams = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0)
	{
		logger.debug(thisFuncName + "thisEvent.team_keys=" + JSON.stringify(thisEvent.team_keys));
		teams = await utilities.find("teams", 
			{"key": {$in: thisEvent.team_keys}}, 
			{sort: {team_number: 1}},
			{allowCache: true}
		);
	}

	//get list of just team numbers
	var teamNumbers = [];
	for(var i in teams){
		teamNumbers[i] = teams[i].team_number;
	}
	
	//get rankings for this event
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	var rankings = await utilities.find("rankings", 
		{"event_key": event_key}, 
		{sort:{rank: 1}}
	);
	if(rankings)
		for(var i = 0; i < rankings.length; i++){
			var rankObj = rankings[i];
			var team = rankObj.team_key;
			
			teamRanks[team] = rankObj.rank;
			
		};
	
	returnData.teamRanks = teamRanks;
	returnData.teamNumbers = teamNumbers;

	var matches = [];
	if(teamKey != 'all'){
		
		//our query for matches collection
		var query = {
			$and: [
				{ event_key: event_key },
				{ "alliances.blue.score": -1 },
				{
					$or: [
						{ "alliances.blue.team_keys": teamKey },
						{ "alliances.red.team_keys": teamKey },
					]
				}
			]
		};
		
		//find matches with our query
		matches = await utilities.find("matches", query, {sort: {time: 1}});

		returnData.matches = matches;
		returnData.team = teamKey;
	}
	//if teamKey is 'all'
	else {
		//find all matches for this event that have not been completed
		matches = await utilities.find("matches", {event_key: event_key, "alliances.blue.score": -1}, {sort: {time: 1}});

		returnData.matches = matches;
	}	

	return returnData;	
}

class AllianceStatsData {
	/**
	 * Return of getAllianceStatsData
	 * @param {string} teams Comma-separated list
	 * @param {array} teamList Split version of teams
	 * @param {array} currentAggRanges currentAggRanges
	 * @param {array} avgdata avgTable
	 * @param {array} maxdata maxTable
	 */
	constructor(teams, teamList, currentAggRanges, avgdata, maxdata) {
		this.teams = teams;
		this.teamList = teamList;
		this.currentAggRanges = currentAggRanges;
		this.avgdata = avgdata;
		this.maxdata = maxdata;
	}
}

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
	var thisFuncName = "reports.getAllianceStatsData(): ";
	logger.info(thisFuncName + 'ENTER event_year=' + event_year + ',event_key=' + event_key + ',org_key=' + org_key + ',teams_list=' + teams_list);
	var returnData = new AllianceStatsData(null, null, null, null, null);

	var teams = teams_list;

	var teamList = teams.split(',');
	logger.debug(thisFuncName + 'teamList=' + JSON.stringify(teamList));

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = cookies[cookie_key];
	var scorelayout = await this.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "team_key": {$in: teamList}, "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group by individual teams
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (this.isQuantifiableType(thisLayout.type)) {
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	logger.trace(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR = await utilities.aggregate("matchscouting", aggQuery);
	var aggresult = {};
	if (aggR)
		aggresult = aggR;
	logger.trace(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Build a map of the result rows by team key
	var aggRowsByTeam = {};
	for (var resultIdx = 0; resultIdx < aggresult.length; resultIdx++)
		aggRowsByTeam[ aggresult[resultIdx]["_id"] ] = aggresult[resultIdx];
	logger.trace( thisFuncName + 'aggRowsByTeam[' + teamList[0] + ']=' + JSON.stringify(aggRowsByTeam[teamList[0]]) );

	// Unspool N rows of aggregate results into tabular form
	var avgTable = [];
	var maxTable = [];

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (this.isQuantifiableType(thisLayout.type)) {
			var avgRow = {};
			var maxRow = {};
			avgRow['key'] = thisLayout.id;
			maxRow['key'] = thisLayout.id;
			for (var teamIdx = 0; teamIdx < teamList.length; teamIdx++)
			{
				if (aggRowsByTeam[teamList[teamIdx]])
				{
					avgRow[teamList[teamIdx]] = (Math.round(aggRowsByTeam[teamList[teamIdx]][thisLayout.id + "AVG"] * 10)/10).toFixed(1);
					maxRow[teamList[teamIdx]] = (Math.round(aggRowsByTeam[teamList[teamIdx]][thisLayout.id + "MAX"] * 10)/10).toFixed(1);
				}
			}
			avgTable.push(avgRow);
			maxTable.push(maxRow);
		}
	}
	logger.trace(thisFuncName + 'avgTable=' + JSON.stringify(avgTable));
	logger.trace(thisFuncName + 'maxTable=' + JSON.stringify(maxTable));

	//
	// Calculate the 'normalized' ranges
	//
	var avgNorms = [];
	for (var i in avgTable) {
		var thisAvg = avgTable[i];
		//logger.debug(thisFuncName + "i=" + i + ",key=" + thisAvg.key);
		var min = 9e9;
		var max = -9e9;
		var theseKeys = Object.keys(thisAvg);
		// Find the minimum & maximum from this range
		for (var j in theseKeys) {
			var thisVal = thisAvg[theseKeys[j]];
			if (thisVal != thisAvg.key) {
				var numVal = parseFloat(thisVal);
				if (numVal < min) min = numVal;
				if (numVal > max) max = numVal;
			}
		}
		// Go through again & set values from 0 to 1, scaled by (val-min)/(max-min)
		var thisNorm = {};
		thisNorm.key = thisAvg.key;
		for (var j in theseKeys) {
			var thisVal = thisAvg[theseKeys[j]];
			if (thisVal != thisAvg.key) {
				var numVal = parseFloat(thisVal);
				// Special case: If max == min then all values are Math.sign(Math.abs(max))
				var normVal = Math.sign(Math.abs(max));
				if (max != min) {
					normVal = (numVal - min) / (max - min);
					thisNorm[theseKeys[j]] = (Math.round(normVal * 10)/10).toFixed(1);
				}
			}
		}
		avgNorms.push(thisNorm);
	}
	// repeat but for maxTable
	var maxNorms = [];
	for (var i in maxTable) {
		var thisMax = maxTable[i];
		//logger.debug(thisFuncName + "i=" + i + ",key=" + thisMax.key);
		var min = 9e9;
		var max = -9e9;
		var theseKeys = Object.keys(thisMax);
		// Find the minimum & maximum from this range
		for (var j in theseKeys) {
			var thisVal = thisMax[theseKeys[j]];
			if (thisVal != thisMax.key) {
				var numVal = parseFloat(thisVal);
				if (numVal < min) min = numVal;
				if (numVal > max) max = numVal;
			}
		}
		// Go through again & set values from 0 to 1, scaled by (val-min)/(max-min)
		var thisNorm = {};
		thisNorm.key = thisMax.key;
		for (var j in theseKeys) {
			var thisVal = thisMax[theseKeys[j]];
			if (thisVal != thisMax.key) {
				var numVal = parseFloat(thisVal);
				// Special case: If max == min then all values are Math.sign(Math.abs(max))
				var normVal = Math.sign(Math.abs(max));
				if (max != min) {
					normVal = (numVal - min) / (max - min);
					thisNorm[theseKeys[j]] = (Math.round(normVal * 10)/10).toFixed(1);
				}
			}
		}
		maxNorms.push(thisNorm);
	}
	logger.trace(thisFuncName + "avgNorms=" + JSON.stringify(avgNorms));
	logger.trace(thisFuncName + "maxNorms=" + JSON.stringify(maxNorms));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	var currentAggRanges = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	
	// set up the return data
	returnData.teams = teams;
	returnData.teamList = teamList;
	returnData.currentAggRanges = currentAggRanges;
	returnData.avgTable = avgTable;
	returnData.maxTable = maxTable;
	returnData.avgNorms = avgNorms;
	returnData.maxNorms = maxNorms;

	return returnData;	
}