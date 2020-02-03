const router = require("express").Router();
const logger = require('log4js').getLogger();
const utilities = require('../../utilities');

router.all('/*', async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
})

router.get("/matches", async function(req, res) {

	var thisFuncName = "current.matches[get]: ";
	logger.debug(thisFuncName + 'ENTER')
	
	var eventId = req.event.key;
		
	// Read matches from DB for specified event
	var matches = await utilities.find("matches", {"event_key": eventId},{sort: {"time": 1}});
		
	res.render("./manage/currentmatches", {
		title: "Matches",
		"matches": matches
	});
});

router.get("/getcurrentteams", async function(req, res){
	
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
})

router.post("/resetmatches", async function(req, res) {
	
	var thisFuncName = "current.resetmatches[post]: ";
	logger.debug(thisFuncName + 'ENTER');
	
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
	logger.debug(thisFuncName + 'ENTER')
	
	var matchId = req.body.matchId;

	var event_year = req.event.year;
	var event_key = req.event.key;

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

	// Delete the current rankings
	await utilities.remove("currentrankings", {});
	// Reload the rankings from TBA
	var rankingUrl = "event/" + eventId + "/rankings";
	logger.debug(thisFuncName + "rankingUrl=" + rankingUrl);

	var rankData = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankinfo = JSON.parse(rankData);
	var rankArr = [];
	if (rankinfo)
		rankArr = rankinfo.rankings;
	//logger.debug(thisFuncName + 'rankArr=' + JSON.stringify(rankArr));

	var rankMap = {};
	for (var rankIdx = 0; rankIdx < rankArr.length; rankIdx++) {
		//logger.debug(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankArr[rankIdx].team_key] = rankArr[rankIdx];
	}

	// Insert into DB
	await utilities.insert("currentrankings", rankArr);
	
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
	var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
		
	var aggQuery = [];
	aggQuery.push({ $match : { "event_key": event_key } });
	var groupClause = {};
	// group teams for 1 row per team
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
		{
			groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	aggQuery.push({ $sort: { _id: 1 } });
	logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// Run the aggregation!
	var aggArray = await utilities.aggregate("scoringdata", aggQuery);
			
	var aggMinMaxArray = [];

	// Cycle through & build a map of min/max values per scoring type per aggregation
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
		{
			var thisMinMax = {};

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

	// Delete the current agg ranges
	await utilities.remove("currentaggranges", {});
	// Reinsert the updated values
	await utilities.insert("currentaggranges", aggMinMaxArray);
	// And we're done!
	res.render("./manage/currentmatches", {
		title: "Matches",
		"matches": matches
	});
});

router.post("/updatematches", async function(req, res) {
	
	var thisFuncName = "current.updatematches[post]: ";
	logger.debug(thisFuncName + 'ENTER')
	
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

	// Delete the current rankings
	await utilities.remove("currentrankings", {});
	// Reload the rankings from TBA
	var rankingUrl = "event/" + eventId + "/rankings";
	logger.debug(thisFuncName + "rankingUrl=" + rankingUrl);

	var rankingData = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankinfo = JSON.parse(rankingData);
	var rankArr = [];
	if (rankinfo)
		rankArr = rankinfo.rankings;
	//logger.debug(thisFuncName + 'rankArr=' + JSON.stringify(rankArr));

	// Insert into DB
	await utilities.insert("currentrankings", rankArr);

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
