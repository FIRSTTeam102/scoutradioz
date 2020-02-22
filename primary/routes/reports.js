const router = require("express").Router();
const logger = require('log4js').getLogger();
const utilities = require('../utilities');
const matchDataHelper = require ('../helpers/matchdatahelper');

router.all('/*', async (req, res, next) => {
	//Require viewer-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_VIEWER)) {
		next();
	}
})

router.get("/", async function(req, res){
	
	// TODO - we should probaby make an index for reports?
	res.redirect('/?alert=No index page for /reports/');
});

router.get("/rankings", async function(req, res){
	
	var thisFuncName = "reports.rankings[get]: ";
	logger.info(thisFuncName + 'ENTER');

	var event_key = req.event.key;

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// var rankings = await utilities.find("currentrankings", {}, {sort:{rank: 1}});
	var rankings = await utilities.find("rankings", {"event_key": event_key}, {sort:{rank: 1}});
	if (!rankings)
		rankings = [];

	res.render("./reports/rankings", {
		title: "Rankings",
		rankings: rankings
	});
});

router.get("/finishedmatches", async function(req, res){
	
	var thisFuncName = "reports.finishedmatches[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// for later querying by event_key
	var event_key = req.event.key;
	logger.debug(thisFuncName + 'event_key=' + event_key);

	// Match history info
	var matches = await utilities.find("matches", {"alliances.red.score": { $ne: -1}, "event_key" : event_key}, {sort: {time: -1}});

	//logger.debug(thisFuncName + 'matches=' + JSON.stringify(matches));
	res.render("./reports/finishedmatches", {
		title: "Matches",
		matches: matches
	});
});

router.get("/upcoming", async function(req, res){
	
	const thisFuncName = "reports.upcoming[GET]: ";
	logger.info(thisFuncName + "ENTER");

	var event_key = req.event.key;

	//check if the page queried a specific team for upcoming
	if(!req.query || !req.query.team)
		var teamKey = 'all';
	else
		var teamKey = req.query.team;
	
	//get our collections
	var teamRanks = {};
	
	//get list of teams for this event
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	//var teams = await utilities.find("currentteams", {}, {sort: {team_number: 1}});
	var thisEventData = await utilities.find("events", {"key": event_key});
	var thisEvent = thisEventData[0];
	var teams = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0)
	{
		logger.debug(thisFuncName + "thisEvent.team_keys=" + JSON.stringify(thisEvent.team_keys));
		teams = await utilities.find("teams", {"key": {$in: thisEvent.team_keys}}, {sort: {team_number: 1}})
	}

	//get list of just team numbers
	var teamNumbers = [];
	for(var i in teams){
		teamNumbers[i] = teams[i].team_number;
	}
	
	//get rankings for this event
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// var rankings = await utilities.find("currentrankings", {}, {sort:{rank: 1}});
	var rankings = await utilities.find("rankings", {"event_key": event_key}, {sort:{rank: 1}});
	if(rankings)
		for(var i = 0; i < rankings.length; i++){
			var rankObj = rankings[i];
			var team = rankObj.team_key;
			
			teamRanks[team] = rankObj.rank;
			
		};
	
	if(teamKey != 'all'){
		
		//our query for matches collection
		var query = {
			$and: [
				{ event_key: req.event.key },
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
		var matches = await utilities.find("matches", query, {sort: {time: 1}});
		// TODO what was 'e'?			
		// if(e)
		// 	return logger.debug(e);
		//if no results, send empty array for view to deal with
		if(!matches)
			return res.render('./reports/upcoming', { title:"Upcoming", matches: [] });
		
		res.render('./reports/upcoming', {
			title: "Upcoming",
			matches: matches,
			teamRanks: teamRanks,
			team: teamKey,
			teamList: teamNumbers
		});
	}
	//if teamKey is 'all'
	else {
		//find all matches for this event that have not been completed
		var matches = await utilities.find("matches", {event_key: req.event.key, "alliances.blue.score": -1}, {sort: {time: 1}});
		// TODO what was 'e'?
		// if(e)
		// 	return logger.debug(e);
		//if no results, send empty array for view to deal with
		if(!matches)
			return res.render('./reports/upcoming', { 
				title: "Events",
				matches: [] 
			});
		
		//render page
		res.render('./reports/upcoming', {
			title: "Upcoming",
			matches: matches,
			teamRanks: teamRanks,
			teamList: teamNumbers
		});
	}	
});

router.get("/teamintel", async function(req, res){
	
	var thisFuncName = "reports.teamintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/?alert=No team specified in Reports page.");
		return;
	}
	logger.debug(thisFuncName + 'teamKey=' + teamKey);
	
	// var rankCol = db.get("currentrankings");
	// var teamsCol = db.get('currentteams');
	// var pitCol = db.get('scoutingdata');
	// var aggCol = db.get('scoringdata');
	// var matchCol = db.get('matches');
	// var scoutCol = db.get("scoutinglayout");
	// var scoreCol = db.get("scoringlayout");
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	logger.debug(event_year);
	
	// Team details
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	var teamFind = await utilities.find("teams", { "key" : teamKey }, {});
	
	// if(e)
	// 	return console.error(e);
	if(!teamFind[0]){
		return res.render('./error', {
			title: "Intel: Team " + teamKey.substring(3),
			error: {
				status: "FRC Team "+teamKey.substring(3)+" does not exist or did not participate in this event."
			}
		});
	}
	var team = teamFind[0];

	// Extract the current team ranking, etc.
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// var rankFind = await utilities.find("currentrankings", {team_key: teamKey}, {sort: {rank: 1}});
	var rankFind = await utilities.find("rankings", {"event_key": event_key, "team_key": teamKey}, {sort:{rank: 1}});

	var ranking = null;
	if (rankFind && rankFind.length > 0)
		ranking = rankFind[0];

	// Pit scouting info
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var pitFind = await utilities.find("pitscouting", { "org_key": org_key, "event_key" : event_key, "team_key" : teamKey }, {});
	var pitData = null;
	var pitData1 = null;
	if (pitFind && pitFind[0]) {
		if (pitFind[0].data)
			pitData = pitFind[0].data;
		if (pitFind[0].data1)
			pitData1 = pitFind[0].data1;
	}
	//logger.debug(thisFuncName + 'pitData=' + JSON.stringify(pitData));

	// Pit data layout
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var layout = await utilities.find("scoutinglayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "pitscouting"}, {sort: {"order": 1}})
	
	//logger.debug(thisFuncName + 'layout=' + JSON.stringify(layout));
	
	// Pull in individual scouting data for this team, for this event, to enhance the match data
	logger.debug(thisFuncName + 'Pulling scoring data for teamKey=' + teamKey + ',event_key=' + event_key);
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggFind = await utilities.find("matchscouting", {"org_key": org_key, "team_key": teamKey, "event_key": event_key}, {});
	// Build a map of match_key->data
	var matchDataMap = {};
	if (aggFind && aggFind.length > 0) {
		for (var mDMidx = 0; mDMidx < aggFind.length; mDMidx++) {
			var thisTeamMatch = aggFind[mDMidx];
			//logger.debug(thisFuncName + 'Match scouting data for thisTeamMatch.match_key=' + thisTeamMatch.match_key);
			if (thisTeamMatch.data)
			{
				//logger.debug(thisFuncName + 'Adding data to map');
				matchDataMap[thisTeamMatch.match_key] = thisTeamMatch.data;
			}
		}
	}
			
	// Match history info
	var matches = await utilities.find("matches", {"alliances.red.score": { $ne: -1}, "event_key" : event_key, $or: [{"alliances.blue.team_keys": teamKey}, {"alliances.red.team_keys": teamKey}]}, {sort: {time: -1}});
	if (matches && matches.length > 0) {
		for (var matchesIdx = 0; matchesIdx < matches.length; matchesIdx++) {
			//logger.debug(thisFuncName + 'For match ' + matches[matchesIdx].key);
			var thisScoreData = matchDataMap[matches[matchesIdx].key];
			if (thisScoreData)
			{
				//logger.debug(thisFuncName + 'Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
				matches[matchesIdx].scoringdata = thisScoreData;
			}
		}
	}
	//logger.debug(thisFuncName + 'matches=' + JSON.stringify(matches));

	// Match data layout - use to build dynamic Mongo aggregation query
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla", "team_key": "frc303" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );	

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": org_key, "event_key": event_key, "team_key": teamKey } });
	var groupClause = {};
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggFind = await utilities.aggregate("matchscouting", aggQuery);
	var aggresult = {};
	if (aggFind && aggFind[0])
		aggresult = aggFind[0];
	//logger.debug(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	var aggTable = [];
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			var aggRow = {};
			aggRow['key'] = thisLayout.id;
			
			// Recompute VAR first = StdDev/Mean
			aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);

			aggRow['min'] = (Math.round(aggresult[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
			aggRow['avg'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
			aggRow['var'] = (Math.round(aggresult[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
			aggRow['max'] = (Math.round(aggresult[thisLayout.id + "MAX"] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}
	//logger.debug(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));

	//logger.debug(thisFuncName + 'pitData=' + JSON.stringify(pitData));
	//logger.debug(thisFuncName + 'pitData1=' + JSON.stringify(pitData1));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/teamintel", {
		title: "Intel: Team " + teamKey.substring(3),
		team: team,
		ranking: ranking,
		data: pitData,
		data1: pitData1,
		layout: layout,
		scorelayout: scorelayout,
		aggdata: aggTable,
		currentAggRanges: currentAggRanges,
		matches: matches,
		matchDataHelper: matchDataHelper
	});
});

router.get("/teamintelhistory", async function(req, res){
	
	var thisFuncName = "reports.teamintelhistory*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/?alert=No team specified in Reports page.");
		return;
	}
	logger.debug(thisFuncName + 'teamKey=' + teamKey);
	
	// need the current year to see data
	var year = (new Date()).getFullYear();
	// need timestamp at 00:00 on Jan 1 for match querying - looking for matches where time > Jan 1. {year}
	var yearString = year + '-01-01T00:00:00';
	var yearInt = new Date(yearString).getTime() / 1000;
	
	// var teamsCol = db.get('teams');
	// var aggCol = db.get('scoringdata');
	// var matchCol = db.get('matches');
	// var scoreCol = db.get("scoringlayout");

	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	// Team details
	var teamsFind = await utilities.find("teams", { "key" : teamKey }, {});
	// if(e)
	// 	return console.error(e);
	if(!teamsFind[0]){
		return res.render('./error', {
			title: "Intel: Team " + teamKey.substring(3),
			error: {
				status: "FRC Team "+teamKey.substring(3)+" does not exist or did not participate in this event."
			}
		});
	}
	var team = teamsFind[0];
	//logger.debug(thisFuncName + 'team=' + JSON.stringify(team));

	// Pull in ALL individual scouting data for this team, for this event, to enhance the match data
	logger.debug(thisFuncName + 'Pulling scoring data for teamKey=' + teamKey);
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggFind = await utilities.find("matchscouting", {"org_key": org_key, "team_key": teamKey, "year": year}, {});
	// Build a map of match_key->data
	var matchDataMap = {};
	if (aggFind && aggFind.length > 0) {
		for (var mDMidx = 0; mDMidx < aggFind.length; mDMidx++) {
			var thisTeamMatch = aggFind[mDMidx];
			//logger.debug(thisFuncName + 'Match scouting data for thisTeamMatch.match_key=' + thisTeamMatch.match_key);
			if (thisTeamMatch.data)
			{
				//logger.debug(thisFuncName + 'Adding data to map');
				matchDataMap[thisTeamMatch.match_key] = thisTeamMatch.data;
			}
		}
	}

	// ALL Match history info
	var yearMatch = year + '/';
	var matches = await utilities.find("matches", {"alliances.red.score": { $ne: -1}, "time": { $gt: yearInt}, $or: [{"alliances.blue.team_keys": teamKey}, {"alliances.red.team_keys": teamKey}]}, {sort: {time: -1}});
	if (matches && matches.length > 0) {
		for (var matchesIdx = 0; matchesIdx < matches.length; matchesIdx++) {
			//logger.debug(thisFuncName + 'For match ' + matches[matchesIdx].key);
			var thisScoreData = matchDataMap[matches[matchesIdx].key];
			if (thisScoreData)
			{
				//logger.debug(thisFuncName + 'Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
				matches[matchesIdx].scoringdata = thisScoreData;
			}
		}
	}
	//logger.debug(thisFuncName + 'matches=' + JSON.stringify(matches));

	// Match data layout - use to build dynamic Mongo aggregation query
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "team_key": "frc303" } },    <- No event; avg across ALL events
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": org_key, "team_key": teamKey, "year": year } });
	var groupClause = {};
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggFind = await utilities.aggregate("matchscouting", aggQuery);
	var aggresult = {};
	if (aggFind && aggFind[0])
		aggresult = aggFind[0];
	//logger.debug(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	var aggTable = [];
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			var aggRow = {};
			aggRow['key'] = thisLayout.id;
			
			// Recompute VAR first = StdDev/Mean
			aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);

			aggRow['min'] = (Math.round(aggresult[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
			aggRow['avg'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
			aggRow['var'] = (Math.round(aggresult[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
			aggRow['max'] = (Math.round(aggresult[thisLayout.id + "MAX"] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}
	//logger.debug(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));

	//logger.debug(thisFuncName + 'pitData=' + JSON.stringify(pitData));
	//logger.debug(thisFuncName + 'pitData1=' + JSON.stringify(pitData1));

	res.render("./reports/teamintelhistory", {
		title: "Intel History: Team " + teamKey.substring(3),
		team: team,
		scorelayout: scorelayout,
		aggdata: aggTable,
		matches: matches
	});
});

router.get("/matchintel*", async function(req, res){
	
	var thisFuncName = "reports.matchintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var matchKey = req.query.key;
	if (!matchKey) {
		res.redirect("/?alert=No match key specified in Match Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'matchKey=' + matchKey);
	
	// var matchCol = db.get('matches');
	//var teamsCol = db.get('teams');
	//var pitCol = db.get('scoutingdata');
	//var currentCol = db.get("current");
	//var scoutCol = db.get("scoutinglayout");

	var matchFind = await utilities.find("matches", {"key": matchKey}, {});
	var match = {};
	if (matchFind && matchFind[0])
		match = matchFind[0];
	
	//logger.debug(thisFuncName + 'match=' + JSON.stringify(match));
	res.render("./reports/matchintel", {
		title: "Intel: Match "+matchKey.substring(matchKey.indexOf('qm')+2),
		match: match
	});
});

router.get("/teammatchintel*", async function(req, res){
	
	var thisFuncName = "reports.teammatchintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var match_team_key = req.query.key;
	if (!match_team_key) {
		res.redirect("/?alert=No team-match key specified in Team Match Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'teamMatchKey=' + match_team_key);
	
	// var scoringDataCol = db.get('scoringdata');
	//var teamsCol = db.get('teams');
	//var pitCol = db.get('scoutingdata');
	//var currentCol = db.get("current");
	// var scoringLayoutCol = db.get("scoringlayout");

	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	// Match data layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var layout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var layout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var layout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoringDataFind = await utilities.find("matchscouting", {"org_key": org_key, "match_team_key": match_team_key}, {});
	var data = null;
	var teammatch = null;
	if (scoringDataFind && scoringDataFind[0]) {
		teammatch = scoringDataFind[0];
		data = teammatch.data;
	}
	
	var title = "Intel: "
	var x = match_team_key;
	var matchType, matchNum;
	var teamNum = x.substring(x.lastIndexOf("_")+4);
	
	if( x.indexOf("qm") != -1 ){
		matchType = "Match";
		matchNum = x.substring(x.indexOf("qm")+2, x.lastIndexOf("_"));
	}
	else if( x.indexOf("qf") != -1){
		matchType = "Quarterfinal";
		matchNum = x.substring(x.indexOf("qf")+2, x.lastIndexOf("_"));
	}
	else if( x.indexOf("sf") != -1 ){
		matchType = "Semifinal";
		matchNum = x.substring(x.indexOf("sf")+2, x.lastIndexOf("_"));
	}
	else{
		matchType = "Final";
		matchNum = x.substring(x.indexOf("f")+2, x.lastIndexOf("_"));
	}
	
	
	//logger.debug(thisFuncName + 'teammatch=' + JSON.stringify(teammatch));
	res.render("./reports/teammatchintel", {
		title: `Intel: ${matchType} ${matchNum} Team ${teamNum}`,
		layout: layout,
		data: data,
		teammatch: teammatch,
		teamKey: match_team_key.split("_")[2],
		matchDataHelper: matchDataHelper
	});
});

router.get("/alliancestats", async function(req, res) {
	
	var thisFuncName = "reports.alliancestats[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var aggCol = db.get('scoringdata');
	// var scoringLayoutCol = db.get("scoringlayout");
	// var currentCol = db.get("current");
	// var matchCol = db.get('matches');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	if( !req.query.teams ){
		return res.redirect("/?alert=Must specify comma-separated list of teams for reports/alliancestats");
	}
	var teams = req.query.teams;
	var teamList = req.query.teams.split(',');
	logger.debug(thisFuncName + 'teamList=' + JSON.stringify(teamList));

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "team_key": {$in: teamList}, "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group by individual teams
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
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
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
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

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggR = await utilities.find("currentaggranges", {}, {});
	var currentAggR = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggR)
		currentAggRanges = currentAggR;

	res.render("./reports/alliancestats", {
		title: "Alliance Team Statistics",
		teams: teams,
		teamList: teamList,
		currentAggRanges: currentAggRanges,
		avgdata: avgTable,
		maxdata: maxTable
	});
});

router.get("/teamdata", async function(req, res) {
	
	var thisFuncName = "reports.teamdata[get]: ";
	logger.info(thisFuncName + 'ENTER');

	// var scoringCol = db.get('scoringdata');
	// var scoringLayoutCol = db.get("scoringlayout");
	// var currentAggCol = db.get("currentaggranges");
	// var teamCol = db.get('currentteams');

	var event_year = req.event.year;
	var event_key = req.event.key;
	var teamKey = req.query.key;
	var org_key = req.user.org_key;

	if( !teamKey ){
		return res.redirect("/?alert=Must specify team key for reports/teamdata");
	}
	logger.debug(`${thisFuncName} teamKey: ${teamKey}`);

	// get the specified team object
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	var teamFind = await utilities.find("teams", {"key": teamKey}, {});

	var team = {};
	if (teamFind && teamFind[0])
		team = teamFind[0];
		
	logger.debug(`${thisFuncName} team: ${JSON.stringify(team)}`);

	// get the scoring data for the matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoringFind = await utilities.find("matchscouting", {"team_key": teamKey, "year": event_year, "org_key": org_key, "event_key": event_key}, {sort: {"match_number": -1}});
	var matches = [];
	if (scoringFind)
		matches = scoringFind;

	logger.trace(`${thisFuncName} matches: ${JSON.stringify(matches)}`);

	// get the scoring layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scoreLayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scoreLayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	logger.trace(`${thisFuncName} scoreLayout: ${JSON.stringify(scoreLayout)}`);

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/teamdata", {
		title: "Scoring Data For Team",
		layout: scoreLayout,
		currentAggRanges: currentAggRanges,
		matches: matches,
		team: team,
		matchDataHelper: matchDataHelper
	});
});

router.get("/matchdata", async function(req, res) {
	
	var thisFuncName = "reports.matchdata[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var scoringCol = db.get('scoringdata');
	// var scoringLayoutCol = db.get("scoringlayout");
	// var currentAggCol = db.get("currentaggranges");
	// var matchCol = db.get('matches');

	var event_year = req.event.year;
	var event_key = req.event.key;
	var matchKey = req.query.key;
	var org_key = req.user.org_key;

	if( !matchKey ){
		return res.redirect("/?alert=Must specify match key for reports/matchdata");
	}
	logger.debug(`${thisFuncName} matchKey: ${matchKey}`);

	// get the specified match object
	var matchFind = await utilities.find("matches", {"key": matchKey}, {});
	var match = {};
	if (matchFind && matchFind[0])
		match = matchFind[0];
		
	logger.trace(`${thisFuncName} match: ${JSON.stringify(match)}`);

	// get the scoring data for the match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoringFind = await utilities.find("matchscouting", {"org_key": org_key, "match_key": matchKey}, {});
	var matches = [];
	if (scoringFind)
		matches = scoringFind;

	logger.trace(`${thisFuncName} matches: ${JSON.stringify(matches)}`);

	// get the scoring layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scoreLayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scoreLayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	logger.trace(`${thisFuncName} scoreLayout: ${JSON.stringify(scoreLayout)}`);

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/matchdata", {
		title: "Scoring Data For Match",
		scoreLayout: scoreLayout,
		currentAggRanges: currentAggRanges,
		matches: matches,
		match: match,
		matchDataHelper: matchDataHelper
	});
});

router.get("/matchmetrics", async function(req, res) {
	
	var thisFuncName = "reports.matchmetrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var aggCol = db.get('scoringdata');
	// var scoringLayoutCol = db.get("scoringlayout");
	// var currentCol = db.get("current");
	// var matchCol = db.get('matches');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	var matchKey = req.query.key;
	var org_key = req.user.org_key;
	
	if( !matchKey ){
		return res.redirect("/?alert=Must specify match key for reports/matchmetrics");
	}
	logger.debug(`${thisFuncName} matchKey: ${matchKey}`);

	// get the specified match object
	var matchFind = await utilities.find("matches", {"key": matchKey}, {});
	var match = {};
	if (matchFind && matchFind[0])
		match = matchFind[0];
		
	logger.trace(`${thisFuncName} match: ${JSON.stringify(match)}`);

	// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
	// db.scoringdata.aggregate( [ 
	// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
	// { $group : { _id: "$event_key",
	// "autoScaleAVG": {$avg: "$data.autoScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	var redAllianceArray = match.alliances.red.team_keys;
	aggQuery.push({ $match : { "team_key": {$in: redAllianceArray}, "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group teams for 1 row per event (we're doing this twice, once for red & once for blue)
	groupClause["_id"] = "$event_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
		if (matchDataHelper.isQuantifiableType(thisLayout.type))
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR = await utilities.aggregate("matchscouting", aggQuery);
	var aggresult = {};
	if (aggR && aggR[0])
		aggresult = aggR[0];
	//logger.debug(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	var aggTable = [];
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			var aggRow = {};
			aggRow['key'] = thisLayout.id;
			aggRow['red'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}

	// repeat aggregation for blue alliance
	aggQuery = [];
	var blueAllianceArray = match.alliances.blue.team_keys;
	aggQuery.push({ $match : { "team_key": {$in: blueAllianceArray}, "org_key": org_key, "event_key": event_key } });
	// reuse prior groupClause
	aggQuery.push({ $group: groupClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR2 = await utilities.aggregate("matchscouting", aggQuery);
	aggresult = {};
	if (aggR2 && aggR2[0])
		aggresult = aggR2[0];
	//logger.debug(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	// Utilize pointer to aggTable to line up data
	var aggTablePointer = 0;
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			aggTable[aggTablePointer].blue = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
			aggTablePointer++;
		}
	}

	logger.trace(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/matchmetrics", {
		title: "Metrics For Upcoming Match",
		aggdata: aggTable,
		currentAggRanges: currentAggRanges,
		match: match
	});
});

router.get("/metricsranked", async function(req, res){
	
	var thisFuncName = "reports.metricsranked[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var aggCol = db.get('scoringdata');
	// var scoreCol = db.get("scoringlayout");
	// var currentCol = db.get("current");
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	// for later querying by event_key
	var event_key = req.event.key;
	logger.debug(thisFuncName + 'event_key=' + event_key);

	// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will combo ALL teams
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group teams for 1 row per team
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			//groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			//groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
			//groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR = await utilities.aggregate("matchscouting", aggQuery);
	var aggData = [];
	//var aggresult = {};
	if (aggR)
		aggData = aggR;
		//aggresult = docs[0];
	//logger.debug(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Unspool rows of aggregate results into tabular form - update values as higher values found
	var aggTable = [];
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			var aggRow = {};
			aggRow['key'] = thisLayout.id;
			aggRow['team'] = 'frcNone';
			aggRow['avg'] = -1;

			// cycle through each team row, looking for a higher (or equal) value for this particular scoring ID
			for (var aggIdx = 0; aggIdx < aggData.length; aggIdx++) {
				var aggresult = aggData[aggIdx];
				// Recompute VAR first = StdDev/Mean
				//aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);
				
				var thisAvg = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
				if (thisAvg > aggRow['avg']) {
					aggRow['team'] = aggresult['_id'];
					aggRow['avg'] = thisAvg;
				}
				else if (thisAvg == aggRow['avg']) {
					if (aggRow['team'] != 'frc(mult)')
						aggRow['team'] = 'frc(mult)';
				}
				
				////aggRow['min'] = (Math.round(aggresult[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
				//aggRow['avg'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
				////aggRow['var'] = (Math.round(aggresult[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
				////aggRow['max'] = (Math.round(aggresult[thisLayout.id + "MAX"] * 10)/10).toFixed(1);
			}
			aggTable.push(aggRow);
		}
	}
	logger.debug(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/metricsranked", {
		title: "Metrics For All Teams",
		currentAggRanges: currentAggRanges,
		aggdata: aggTable
	});
});

router.get("/metrics", async function(req, res){
	
	var thisFuncName = "reports.metrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var aggCol = db.get('scoringdata');
	// var scoreCol = db.get("scoringlayout");
	// var currentCol = db.get("current");
	// var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	// for later querying by event_key
	var event_key = req.event.key;
	logger.debug(thisFuncName + 'event_key=' + event_key);

	// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will combo ALL teams
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group on event for single row
	groupClause["_id"] = "$event_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR = await utilities.aggregate("matchscouting", aggQuery);
	var aggresult = {};
	if (aggR && aggR[0])
		aggresult = aggR[0];
	//logger.debug(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	var aggTable = [];
	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			var aggRow = {};
			aggRow['key'] = thisLayout.id;
			
			// Recompute VAR first = StdDev/Mean
			aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);
		
			aggRow['min'] = (Math.round(aggresult[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
			aggRow['avg'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
			aggRow['var'] = (Math.round(aggresult[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
			aggRow['max'] = (Math.round(aggresult[thisLayout.id + "MAX"] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}
	//logger.debug(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/metrics", {
		title: "Metrics For All Teams",
		currentAggRanges: currentAggRanges,
		aggdata: aggTable
	});
});

router.get("/metricintel*", async function(req, res){
	
	var thisFuncName = "reports.metric*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var metricKey = req.query.key;
	if (!metricKey) {
		res.redirect("/?alert=No metric key specified in Metric Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'metricKey=' + metricKey);
	
	// var aggCol = db.get('scoringdata');
	// var currentCol = db.get("current");
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	
	// for later querying by event_key
	var event_key = req.event.key;
	var org_key = req.user.org_key;
	logger.debug(thisFuncName + 'event_key=' + event_key);

	// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will output ALL teams
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );						
	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group on team for multiple rows
	groupClause["_id"] = "$team_key";

	groupClause[metricKey + "MIN"] = {$min: "$data." + metricKey};
	groupClause[metricKey + "AVG"] = {$avg: "$data." + metricKey};
	groupClause[metricKey + "VAR"] = {$stdDevPop: "$data." + metricKey};
	groupClause[metricKey + "MAX"] = {$max: "$data." + metricKey};

	var sortKey = metricKey + "AVG";
	var sortClause = {};
	sortClause[sortKey] = -1;

	aggQuery.push({ $group: groupClause }, { $sort: sortClause });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggdata = await utilities.aggregate("matchscouting", aggQuery);

	if (aggdata) {
		for (var aggIdx in aggdata) {
			var thisAgg = aggdata[aggIdx];
			// Recompute VAR first = StdDev/Mean
			thisAgg[metricKey + "VAR"] = thisAgg[metricKey + "VAR"] / (thisAgg[metricKey + "AVG"] + 0.001);
			
			thisAgg[metricKey + "MIN"] = (Math.round(thisAgg[metricKey + "MIN"] * 10)/10).toFixed(1);
			thisAgg[metricKey + "AVG"] = (Math.round(thisAgg[metricKey + "AVG"] * 10)/10).toFixed(1);
			thisAgg[metricKey + "VAR"] = (Math.round(thisAgg[metricKey + "VAR"] * 10)/10).toFixed(1);
			thisAgg[metricKey + "MAX"] = (Math.round(thisAgg[metricKey + "MAX"] * 10)/10).toFixed(1);
		}
	}
	
	//logger.debug(thisFuncName + 'aggdata=' + JSON.stringify(aggdata));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/metricintel", {
		title: "Intel: " + metricKey,
		aggdata: aggdata,
		currentAggRanges: currentAggRanges,
		key: metricKey
	});
});

/**
 * Metrics view
 */
router.get("/allteammetrics", async function(req, res){
	
	var thisFuncName = "reports.allteammetrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var aggCol = db.get('scoringdata');
	// var scoreCol = db.get("scoringlayout");
	// var rankCol = db.get('currentrankings');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	
	// for later querying by event_key
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	logger.debug(thisFuncName + 'event_key=' + event_key);
	
	// get the current rankings
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// var rankFind = await utilities.find("currentrankings", {}, {});
	var rankFind = await utilities.find("rankings", {"event_key": event_key}, {});
	
	var rankings = [];
	if (rankFind)
		rankings = rankFind;
	var rankMap = {};
	for (var rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
		//logger.debug(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
	}
	//logger.debug(thisFuncName + 'rankMap=' + JSON.stringify(rankMap));

	// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
	// db.scoringdata.aggregate( [ 
	// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
	// { $group : { _id: "$event_key",
	// "autoScaleAVG": {$avg: "$data.autoScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});

	// Variables ahead of modifying match scoring layout for cookies
	// 2020-02-15, M.O'C: Leverage column selection cookies - pull in the cookies
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	/*
	var scorelayout = [];
	var scorelayoutDB = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	
	var savedCols = {};
	var noneSelected = true;
	//colCookie = "a,b,ccc,d";
	if (colCookie) {
		logger.debug(thisFuncName + "colCookie=" + colCookie);
		noneSelected = false;
		var savedColArray = colCookie.split(",");
		for (var i in savedColArray)
			savedCols[savedColArray[i]] = savedColArray[i];
	}
	//logger.debug(thisFuncName + "noneSelected=" + noneSelected + ",savedCols=" + JSON.stringify(savedCols));

	// Use the cookies (if defined) to slim down the layout array
	if (noneSelected)
		scorelayout = scorelayoutDB;
	else {
		// Weed out unselected columns
		for (var i in scorelayoutDB) {
			var thisLayout = scorelayoutDB[i];
			//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
			if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
				if (savedCols[thisLayout.id]) 
					scorelayout.push(thisLayout);
			}
			else
				scorelayout.push(thisLayout);
		}
	}
	*/

	// Build the aggregation data
	var aggQuery = [];
	aggQuery.push({ $match : { "org_key": org_key, "event_key": event_key } });
	var groupClause = {};
	// group teams for 1 row per team
	groupClause["_id"] = "$team_key";

	for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		var thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		// 2020-02-15, M.O'C: Leverage column selection cookies
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	aggQuery.push({ $sort: { _id: 1 } });
	//logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggR = await utilities.aggregate("matchscouting", aggQuery);
	var aggArray = [];
	if (aggR)
		aggArray = aggR;
		
	//logger.debug(thisFuncName + 'rankMap=' + rankMap);
	
	// Rewrite data into display-friendly values
	for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
		var thisAgg = aggArray[aggIdx];
		for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			var thisLayout = scorelayout[scoreIdx];
			//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
			if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
				var roundedValAvg = (Math.round(thisAgg[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
				var roundedValMax = (Math.round(thisAgg[thisLayout.id + "MAX"] * 10)/10).toFixed(1);
				thisAgg[thisLayout.id + "AVG"] = roundedValAvg;
				thisAgg[thisLayout.id + "MAX"] = roundedValMax;
			}
		}
		if(rankMap[thisAgg._id]){
			thisAgg['rank'] = rankMap[thisAgg._id].rank;
			thisAgg['value'] = rankMap[thisAgg._id].value;
			aggArray[aggIdx] = thisAgg;
		}
	}
	//logger.debug(thisFuncName + 'aggArray=' + JSON.stringify(aggArray));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// currentAggFind = await utilities.find("currentaggranges", {}, {});
	var currentAggFind = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggFind)
		currentAggRanges = currentAggFind;

	res.render("./reports/allteammetrics", {
		title: "Alliance Selection",
		aggdata: aggArray,
		currentAggRanges: currentAggRanges,
		layout: scorelayout,
		matchDataHelper: matchDataHelper
	});
});

//// Choosing & setting scoring selections

router.get("/choosecolumns", async function(req, res) {
	var thisFuncName = "reports.choosecolumns[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;

	// read in the list of form options
	var matchlayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	//logger.debug(thisFuncName + "matchlayout=" + JSON.stringify(matchlayout))

	var cookie_key = org_key + "_" + event_year + "_cols";
	var savedCols = {};
	var colCookie = req.cookies[cookie_key];

	if (req.cookies[cookie_key]) {
		logger.trace(thisFuncName + "req.cookies[cookie_key]=" + JSON.stringify(req.cookies[cookie_key]))
	}

	//colCookie = "a,b,ccc,d";
	if (colCookie) {
		var savedColArray = colCookie.split(",");
		for (var i in savedColArray)
			savedCols[savedColArray[i]] = savedColArray[i];
	}
	logger.debug(thisFuncName + "savedCols=" + JSON.stringify(savedCols))

	res.render("./reports/choosecolumns", {
		title: "Choose Report Columns",
		layout: matchlayout,
		savedCols: savedCols,
		matchDataHelper: matchDataHelper
	});
});

router.post("/choosecolumns", async function(req, res){
	var thisFuncName = "reports.choosecolumns[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	var cookie_key = org_key + "_" + event_year + "_cols";

	logger.trace(thisFuncName + "req.body=" + JSON.stringify(req.body));
	var first = true;
	var columnCookie = '';
	for (var i in req.body) {
		if (first)
			first = false;
		else
			columnCookie += ','; 
		columnCookie += i;
	}
	logger.debug(thisFuncName + "columnCookie=" + columnCookie);

	res.cookie(cookie_key, columnCookie, {maxAge: 30E9});

	/*
	//2019-11-20 JL: updated to only work with members of the right organization.
	const orgKey = req.user.org_key;
	
	await utilities.update("users", {org_key: orgKey}, { $set: { "event_info.present" : "false" } }, {multi: true});
	
	//Get a list of all present member IDs.
	var allPresentMembers = [];
	for(var i in req.body)
	{
		allPresentMembers.push(monk.id(i));
	}
	
	console.log(`updatepresent: allPresentMembers: ${JSON.stringify(allPresentMembers)}`);
	
	var query = {"_id": {$in: allPresentMembers}, org_key: orgKey};
	var update = {$set: {"event_info.present": true}};
	
	await utilities.update("users", query, update, {multi: true, castIds: true});
	*/
	
	res.redirect("../home");
});

module.exports = router;