const router = require("express").Router();
const logger = require('log4js').getLogger();
const utilities = require('../../utilities');
const matchDataHelper = require ('../../helpers/matchdatahelper');

router.all('/*', async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
})

router.get("/matches", async function(req, res) {

	var thisFuncName = "current.matches[get]: ";
	logger.info(thisFuncName + 'ENTER')
	
	var eventId = req.event.key;
		
	// Read matches from DB for specified event
	var matches = await utilities.find("matches", {"event_key": eventId},{sort: {"time": 1}});
		
	res.render("./manage/currentmatches", {
		title: "Matches",
		"matches": matches
	});
});

router.get("/getcurrentteams", async function(req, res){

	var thisFuncName = "currentevent.getcurrentteams[get]: ";
	logger.info(thisFuncName + 'ENTER');

	// 2020-02-09, M.O'C: Refactoring to just update the team_keys for the current event
	var event_key = req.event.key;

	// Get the current event
	//var thisEventData = await utilities.find("events", {"key": event_key});
	//var thisEvent = thisEventData[0];

	// Refresh the teams list from TBA
	var eventTeamsUrl = `event/${event_key}/teams/keys`;
	var thisTeamKeysData = await utilities.requestTheBlueAlliance(eventTeamsUrl);
	var thisTeamKeys = JSON.parse(thisTeamKeysData);
	await utilities.update( "events", {"key": event_key}, {$set: {"team_keys": thisTeamKeys}} );

	res.redirect('/manage?alert=Updated team keys for the current event successfully.');

	///////////////// OLD DEPRECATED CODE

	/*
	// //get TBA key from db
	// var passwordsFind = await utilities.find("passwords", { name:"thebluealliance-args" });
	// if(!passwordsFind[0]){
	// 	return res.status(500).send("couldn't find TBA args in db");
	// }
	// args = passwordsFind[0];
	
	//set up tba call
	// var Client = require('node-rest-client').Client;
	// var client = new Client();
	var eventId = req.event.key;
	var teamsUrl = `event/${eventId}/teams`;
	
	//get teams from tba
	var data = await utilities.requestTheBlueAlliance(teamsUrl);
		
	var currentTeams = JSON.parse(data);
	
	if(!currentTeams){
		return res.status(500).send("didn't get teams list");
	}
	
	//delete contents of currentteams
	await utilities.remove("currentteams", {});
		
	//insert teams into currentteams
	await utilities.insert("currentteams", currentTeams);

	res.redirect('/manage?alert=Updated current teams successfully.');
	*/
})

router.post("/resetmatches", async function(req, res) {
	
	var thisFuncName = "current.resetmatches[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var matchCol = db.get("matches");
	
	var eventId = req.event.key;
	
	// update all matches - set 'actualtime' to null/"", and team scores to -1
	await utilities.bulkWrite("matches", [{updateMany:{filter:{"event_key": eventId}, update:{ $set: { "actual_time" : "", "winning_alliance" : "", "alliances.blue.score": -1, "alliances.red.score": -1 } }}}]);

	// reread the data & render
	var matches = await utilities.find("matches", {"event_key": eventId},{sort: {"time": 1}});
	
	res.render("./manage/currentmatches", {
		title: "Matches",
		"matches": matches
	});
});

router.post("/updatematch", async function(req, res) {
	
	var thisFuncName = "current.updatematch[post]: ";
	logger.info(thisFuncName + 'ENTER')
	
	var matchId = req.body.matchId;

	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	// var matchCol = db.get("matches");
	// var rankCol = db.get("currentrankings");
	// // 2019-03-21, M.O'C: Adding in aggregation of scoring data to generate & save min/max ranges for all scoring attributes
	// var scoreCol = db.get("scoringlayout");
	// var aggCol = db.get('scoringdata');
	// // And INTRODUCING... The 'currentaggranges' collection
	// var currentAggCol = db.get("currentaggranges");

	// REST client for accessing TBA
	// var client = req.client;
	// var args = req.tbaRequestArgs;
	
	var eventId = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Reload the rankings from TBA
	var rankingUrl = "event/" + eventId + "/rankings";
	logger.debug(thisFuncName + "rankingUrl=" + rankingUrl);

	var rankData = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankinfo = JSON.parse(rankData);
	var rankArr = [];
	if (rankinfo && rankinfo.rankings && rankinfo.rankings.length > 0)
	{
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'; enrich with event_key 
		var thisRankings = rankinfo.rankings;
		for (var i in thisRankings) {
			var thisRank = thisRankings[i];
			thisRank['event_key'] = eventId;
			rankArr.push(thisRank);
		}
	}
	//logger.debug(thisFuncName + 'rankArr=' + JSON.stringify(rankArr));

	var rankMap = {};
	for (var rankIdx = 0; rankIdx < rankArr.length; rankIdx++) {
		//logger.debug(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankArr[rankIdx].team_key] = rankArr[rankIdx];
	}

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// Delete the current rankings
	//await utilities.remove("currentrankings", {});
	await utilities.remove("rankings", {"event_key": event_key});
	// Insert into DB
	//await utilities.insert("currentrankings", rankArr);
	await utilities.insert("rankings", rankArr);

	// Delete the matching match record
	await utilities.remove("matches", {"key": matchId});

	// Reload the match data from TBA
	var url = "match/" + matchId;
	logger.debug(thisFuncName + "url=" + url);
	var matchData = await utilities.requestTheBlueAlliance(url);
	var match = JSON.parse(matchData);
	// stick it in an array so the insert will work later
	var array = [];
	array.push(match);
	
	// Now, insert the new object
	await utilities.insert("matches", array);
	// Then read all the matches back in order
	var matches = await utilities.find("matches", {"event_key": eventId},{sort: {"time": 1}});

	//
	// 2019-03-21, M.O'C: Adding in recalculation of aggregation data
	//
	logger.debug(thisFuncName + 'About to start in on updating min/maxes of agg data');
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
			
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
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
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
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
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

			logger.debug(thisFuncName + 'thisMinMax=' + JSON.stringify(thisMinMax));

			aggMinMaxArray.push(thisMinMax);
		}
	}
	console.log(thisFuncName + 'aggMinMaxArray=' + JSON.stringify(aggMinMaxArray));

	// 2020-02-08, M.O'C: Tweaking agg ranges
	// Delete the current agg ranges
	// await utilities.remove("currentaggranges", {});
	await utilities.remove("aggranges", {"org_key": org_key, "event_key": event_key});
	// Reinsert the updated values
	// await utilities.insert("currentaggranges", aggMinMaxArray);
	await utilities.insert("aggranges", aggMinMaxArray);

	// And we're done!
	res.render("./manage/currentmatches", {
		title: "Matches",
		"matches": matches
	});
});

router.post("/updatematches", async function(req, res) {
	
	var thisFuncName = "current.updatematches[post]: ";
	logger.info(thisFuncName + 'ENTER')
	
	// var matchCol = db.get("matches");
	// var rankCol = db.get("currentrankings");
	
	// nodeclient
	var Client = require('node-rest-client').Client;
	var client = new Client();
	var args = {
		headers: { "accept": "application/json", "X-TBA-Auth-Key": "iSpbq2JH2g27Jx2CI5yujDsoKYeC8pGuMw94YeK3gXFU6lili7S2ByYZYZOYI3ew" }
	}
	
	var matchId = req.body.matchId;
	var eventId = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Reload the rankings from TBA
	var rankingUrl = "event/" + eventId + "/rankings";
	logger.debug(thisFuncName + "rankingUrl=" + rankingUrl);

	var rankingData = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankinfo = JSON.parse(rankingData);
	var rankArr = [];
	if (rankinfo && rankinfo.rankings && rankinfo.rankings.length > 0)
	{
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'; enrich with event_key 
		var thisRankings = rankinfo.rankings;
		for (var i in thisRankings) {
			var thisRank = thisRankings[i];
			thisRank['event_key'] = eventId;
			rankArr.push(thisRank);
		}
	}
	logger.debug(thisFuncName + 'rankArr=' + JSON.stringify(rankArr));

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// Delete the current rankings
	//await utilities.remove("currentrankings", {});
	await utilities.remove("rankings", {"event_key": event_key});
	// Insert into DB
	//await utilities.insert("currentrankings", rankArr);
	await utilities.insert("rankings", rankArr);

	// Get matches data from TBA
	var url = "event/" + eventId + "/matches";
	logger.debug(thisFuncName + "url=" + url);
	var matchData = await utilities.requestTheBlueAlliance(url);
	var array = JSON.parse(matchData);
	var arrayLength = array.length;
	if (arrayLength == null)
	{
		logger.debug(thisFuncName + "Whoops, there was an error!")
		logger.debug(thisFuncName + "data=" + data);
		
		res.render('./manage/admin', { 
			title: 'Admin pages',
			current: eventId
		});
	}
	else
	{
		logger.debug(thisFuncName + 'Found ' + arrayLength + ' data for event ' + eventId);
		
		// First delete existing match data for the given event
		await utilities.remove("matches", {"event_key": eventId});
		// Now, insert the new data
		await utilities.insert("matches", array);
		// Then read it back in order
		var matches = await utilities.find("matches", {"event_key": eventId},{sort: {"time": 1}});
			
		res.render("./manage/currentmatches", {
			"matches": matches
		});
	}
});

module.exports = router;
