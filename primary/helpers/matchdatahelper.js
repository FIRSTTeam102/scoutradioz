const logger = require('log4js').getLogger();
const utilities = require("@firstteam102/scoutradioz-utilities");

var functions = module.exports = {};

functions.isQuantifiableType = function(type) {
	
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

//
// Needs:    org_key, event_year [number!], colCookie [comma-separated list of metric IDs]
// Returns:  "matchscouting" layout modified(reduced) by the list from colCookie
// 
functions.getModifiedMatchScoutingLayout = async function(org_key, event_year, colCookie) {
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

//
// Needs: org_key, event_year [number!], event_key
// Does:  recalculates aggregated data ranges for that org & event and stores in DB
// 
functions.calculateAndStoreAggRanges = async function(org_key, event_year, event_key) {
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