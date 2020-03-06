const router = require("express").Router();
const logger = require('log4js').getLogger();
const wrap = require('express-async-handler');
const utilities = require('../utilities');
const matchDataHelper = require('../helpers/matchdatahelper');
const uploadHelper = require('../helpers/uploadhelper');

router.all('/*', wrap(async (req, res, next) => {
	//Require viewer-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_VIEWER)) {
		next();
	}
}));

router.get("/", wrap(async (req, res) => {
	
	// TODO - we should probaby make an index for reports?
	res.redirect('/?alert=No index page for /reports/');
}));

router.get("/rankings", wrap(async (req, res) => {
	
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
}));

router.get("/finishedmatches", wrap(async (req, res) => {
	
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
}));

router.get("/upcoming", wrap(async (req, res) => {
	
	const thisFuncName = "reports.upcoming[GET]: ";
	logger.info(thisFuncName + "ENTER");

	var event_key = req.event.key;

	//check if the page queried a specific team for upcoming
	if(!req.query || !req.query.team)
		var teamKey = 'all';
	else
		var teamKey = req.query.team;

	// use helper function
	var upcomingData = await getUpcomingMatchData(event_key, teamKey);

	var matches = upcomingData.matches;
	var teamRanks = upcomingData.teamRanks;
	var teamNumbers = upcomingData.teamNumbers;

	if(teamKey != 'all'){
		res.render('./reports/upcoming', {
			title: "Upcoming",
			matches: matches,
			teamRanks: teamRanks,
			team: teamKey,
			teamNumbers: teamNumbers
		});
	}
	//if teamKey is 'all'
	else {
		//render page
		res.render('./reports/upcoming', {
			title: "Upcoming",
			matches: matches,
			teamRanks: teamRanks,
			teamList: teamNumbers
		});
	}	
}));

router.get("/teamintel", wrap(async (req, res) => {
	
	var thisFuncName = "reports.teamintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/?alert=No team specified in Reports page.");
		return;
	}
	logger.debug(thisFuncName + 'teamKey=' + teamKey);
		
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	logger.debug(thisFuncName + "event_year=" + event_year);
	
	// Team details
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	// 2020-02-29, JL: Changed utilities.find to utilities.findOne
	var team = await utilities.findOne("teams", { "key" : teamKey }, {});
	
	if(!team){
		return res.render('./error', {
			title: "Intel: Team " + teamKey.substring(3),
			error: {
				status: "FRC Team "+teamKey.substring(3)+" does not exist or did not participate in this event."
			}
		});
	}

	// Extract the current team ranking, etc.
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// 2020-02-29, JL: Change utilities.find to utilities.findOne
	var ranking = await utilities.findOne("rankings", {"event_key": event_key, "team_key": teamKey}, {sort:{rank: 1}});
	
	// Pit scouting info
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	// 2020-02-29, JL: Change utilities.find to utilities.findOne
	var pitFind = await utilities.findOne("pitscouting", { "org_key": org_key, "event_key" : event_key, "team_key" : teamKey }, {});
	var pitData = null;
	var pitData1 = null;
	if (pitFind) {
		if (pitFind)
			pitData = pitFind.data;
		if (pitFind.data1)
			pitData1 = pitFind.data1;
	}
	
	// Pit data layout
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	var layout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "pitscouting"}, {sort: {"order": 1}})
	
	logger.trace(thisFuncName + 'layout=' + JSON.stringify(layout));
	
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
	logger.trace(thisFuncName + 'matches=' + JSON.stringify(matches));
	
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
	
	const images = await uploadHelper.findTeamImages(org_key, event_year, teamKey);
	
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
		matchDataHelper: matchDataHelper,
		images: images
	});
}));

router.get("/teamintelhistory", wrap(async (req, res) => {
	
	var thisFuncName = "reports.teamintelhistory*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/?alert=No team specified in Reports page.");
		return;
	}
	logger.debug(thisFuncName + 'teamKey=' + teamKey);
	
	// 2020-02-21, M.O'C: Fixed to be event year
	var year = req.event.year;
	// need timestamp at 00:00 on Jan 1 for match querying - looking for matches where time > Jan 1. {year}
	var yearString = year + '-01-01T00:00:00';
	var yearInt = new Date(yearString).getTime() / 1000;
	
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
		matches: matches,
		year: year
	});
}));

router.get("/matchintel*", wrap(async (req, res) => {
	
	var thisFuncName = "reports.matchintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var matchKey = req.query.key;
	if (!matchKey) {
		res.redirect("/?alert=No match key specified in Match Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'matchKey=' + matchKey);
	
	var matchFind = await utilities.find("matches", {"key": matchKey}, {});
	var match = {};
	if (matchFind && matchFind[0])
		match = matchFind[0];
	
	//logger.debug(thisFuncName + 'match=' + JSON.stringify(match));
	res.render("./reports/matchintel", {
		title: "Intel: Match "+matchKey.substring(matchKey.indexOf('qm')+2),
		match: match
	});
}));

router.get("/teammatchintel*", wrap(async (req, res) => {
	
	var thisFuncName = "reports.teammatchintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var match_team_key = req.query.key;
	if (!match_team_key) {
		res.redirect("/?alert=No team-match key specified in Team Match Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'teamMatchKey=' + match_team_key);
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	// Match data layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var layout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})

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
}));

router.get("/alliancestats", wrap(async (req, res) =>  {
	
	var thisFuncName = "reports.alliancestats[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	if( !req.query.teams ){
		return res.redirect("/?alert=Must specify comma-separated list of teams for reports/alliancestats");
	}
	var teams = req.query.teams;

	// use helper function
	var allianceStatsData = await getAllianceStatsData(event_year, event_key, org_key, teams, req.cookies);

	var teams = allianceStatsData.teams;
	var teamList = allianceStatsData.teamList;
	var currentAggRanges = allianceStatsData.currentAggRanges;
	var avgTable = allianceStatsData.avgTable;
	var maxTable = allianceStatsData.maxTable;
	var avgNorms = allianceStatsData.avgNorms;
	var maxNorms = allianceStatsData.maxNorms;

	res.render("./reports/alliancestats", {
		title: "Alliance Team Statistics",
		teams: teams,
		teamList: teamList,
		currentAggRanges: currentAggRanges,
		avgdata: avgTable,
		maxdata: maxTable,
		avgnorms: avgNorms,
		maxnorms: maxNorms
	});
}));

router.get("/teamdata", wrap(async (req, res) =>  {
	
	var thisFuncName = "reports.teamdata[get]: ";
	logger.info(thisFuncName + 'ENTER');

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
}));

router.get("/matchdata", wrap(async (req, res) =>  {
	
	var thisFuncName = "reports.matchdata[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
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
}));

router.get("/matchmetrics", wrap(async (req, res) =>  {
	
	var thisFuncName = "reports.matchmetrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
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
}));

router.get("/metricsranked", wrap(async (req, res) => {
	
	var thisFuncName = "reports.metricsranked[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
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
}));

router.get("/metrics", wrap(async (req, res) => {
	
	var thisFuncName = "reports.metrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
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
}));

router.get("/metricintel*", wrap(async (req, res) => {
	
	var thisFuncName = "reports.metric*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var metricKey = req.query.key;
	if (!metricKey) {
		res.redirect("/?alert=No metric key specified in Metric Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'metricKey=' + metricKey);
	
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
}));

/**
 * Metrics view
 */
router.get("/allteammetrics", wrap(async (req, res) => {
	
	var thisFuncName = "reports.allteammetrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
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

	// Variables ahead of modifying match scoring layout for cookies
	// 2020-02-15, M.O'C: Leverage column selection cookies - pull in the cookies
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

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
}));

/**
 * Drive team dashboard view: Combination of [a] compare alliances and [b] upcoming matches
 * -- Pass in a team_key as 'team'
 * >> If null, use the organization's default; if no default, return nothing
 */
router.get("/drivedashboard", wrap(async (req, res) => {
	
	var thisFuncName = "reports.drivedashboard[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// for later querying by event_key
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	logger.debug(thisFuncName + 'event_key=' + event_key);
	
	//check if the page queried a specific team for upcoming
	var teamKey = "all";
	if(!req.query || !req.query.team) {
		// get the default team from the org
		var thisOrg = await utilities.findOne("orgs", {org_key: org_key});
		if (thisOrg && thisOrg.team_key) teamKey = thisOrg.team_key;
	}
	else
		teamKey = req.query.team;

	//
	// Get upcoming match data for the specified team (or "all" if no default & none specified)
	//
	var upcomingData = await getUpcomingMatchData(event_key, teamKey);
	// Data for the upcoming matches portion
	var teamRanks = upcomingData.teamRanks;
	var teamNumbers = upcomingData.teamNumbers;

	//
	// Prepare empty alliance stats data
	//
	var teams = null;
	var teamList = null;
	var currentAggRanges = null;
	var avgTable = null;
	var maxTable = null;

	//
	// Pull out the first match (if it exists), get the team keys from the alliances
	//
	var matches = upcomingData.matches;
	if (matches && matches.length > 0) {
		var firstMatch = matches[0];
		//logger.debug(thisFuncName + 'firstMatch=' + JSON.stringify(firstMatch));

		var teamKeyList = "";
		var notFirst = true;
		var redArray = firstMatch.alliances.red.team_keys; 
		for (var i in redArray) {
			if (notFirst) {
				teamKeyList = redArray[i];
				notFirst = false;
			} else {
				teamKeyList += "," + redArray[i];
			}
		}
		teamKeyList += ",0";
		var blueArray = firstMatch.alliances.blue.team_keys; 
		for (var i in blueArray)
			teamKeyList += "," + blueArray[i];
		logger.debug(thisFuncName + "teamKeyList=" + teamKeyList);

		//
		// Get the alliance stats
		//
		var allianceStatsData = await getAllianceStatsData(event_year, event_key, org_key, teamKeyList, req.cookies);

		teams = allianceStatsData.teams;
		teamList = allianceStatsData.teamList;
		currentAggRanges = allianceStatsData.currentAggRanges;
		avgTable = allianceStatsData.avgTable;
		maxTable = allianceStatsData.maxTable;
		avgNorms = allianceStatsData.avgNorms;
		maxNorms = allianceStatsData.maxNorms;

		//logger.debug(thisFuncName + "avgNorms=" + JSON.stringify(avgNorms));
		//logger.debug(thisFuncName + "maxNorms=" + JSON.stringify(maxNorms));
	}

	// TODO
	// res.render('./reports/upcoming', {
	// 	title: "Upcoming",
	res.render("./reports/alliancestats", {
		title: "Alliance Team Statistics",
		teams: teams,
		teamList: teamList,
		currentAggRanges: currentAggRanges,
		avgdata: avgTable,
		maxdata: maxTable,
		avgnorms: avgNorms,
		maxnorms: maxNorms,
		matches: matches,
		teamRanks: teamRanks,
		team: teamKey,
		teamNumbers: teamNumbers
	});
}));


//// Choosing & setting scoring selections

router.get("/choosecolumns", wrap(async (req, res) =>  {
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
}));

router.post("/choosecolumns", wrap(async (req, res) => {
	var thisFuncName = "reports.choosecolumns[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	var cookie_key = org_key + "_" + event_year + "_cols";

	var setOrgDefault = false;

	logger.trace(thisFuncName + "req.body=" + JSON.stringify(req.body));
	var first = true;
	var columnCookie = '';
	for (var i in req.body) {
		if (i == 'setOrgDefault')    // see choosecolumns.pug
			setOrgDefault = true;
		else {
			if (first)
				first = false;
			else
				columnCookie += ','; 
			columnCookie += i;
		}
	}
	logger.debug(thisFuncName + "columnCookie=" + columnCookie);

	res.cookie(cookie_key, columnCookie, {maxAge: 30E9});
	
	// setting org defaults? NOTE only for Team Admins and above
	if (setOrgDefault && req.user.role.access_level >= process.env.ACCESS_TEAM_ADMIN) {
		logger.debug(thisFuncName + "Setting org defaults");
		var thisOrg = await utilities.findOne("orgs", {org_key: org_key});
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

		// set the defaults for this year
		theseColDefaults[event_year] = columnCookie;
		
		// update DB
		await utilities.update("orgs", {org_key: org_key}, {$set: {"config.columnDefaults": theseColDefaults}});

		//logger.debug(thisFuncName + "thisOrg=" + JSON.stringify(thisOrg));
	}

	res.redirect("../home");
}));

router.post("/clearorgdefaultcols", wrap(async (req, res) => {
	var thisFuncName = "reports.clearorgdefaultcols[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var event_year = req.event.year;
	var org_key = req.user.org_key;

	if (req.user.role.access_level >= process.env.ACCESS_TEAM_ADMIN) {
		var thisOrg = await utilities.findOne("orgs", {org_key: org_key});
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

		// remove values (if they exist) for the event year
		delete theseColDefaults[event_year];

		// update DB
		await utilities.update("orgs", {org_key: org_key}, {$set: {"config.columnDefaults": theseColDefaults}});
	}

	res.redirect("../home");
}));

////////// Helper functions

// Takes
//   event_key
//   team_key (can be 'all' or null)
// Returns a data blob containing the *starred* attributes:
//   matches: *matches*,
//   teamRanks: *teamRanks*, {map of team #s to rankings}
//   team: *teamKey*,
//   teamList: *teamNumbers* {array of team #s?}
async function getUpcomingMatchData( event_key, team_key ) {
	var thisFuncName = "reports.getUpcomingMatchData(): ";
	logger.info(thisFuncName + 'ENTER event_key=' + event_key + ',team_key=' + team_key);
	var returnData = {};

	var teamKey = team_key;
	if(!team_key)
		teamKey = 'all';

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
		// TODO what was 'e'?			
		// if(e)
		// 	return logger.debug(e);
		//if no results, send empty array for view to deal with
		if(!matches)
			matches = [];

		returnData.matches = matches;
		returnData.team = teamKey;
	}
	//if teamKey is 'all'
	else {
		//find all matches for this event that have not been completed
		var matches = await utilities.find("matches", {event_key: event_key, "alliances.blue.score": -1}, {sort: {time: 1}});
		// TODO what was 'e'?
		// if(e)
		// 	return logger.debug(e);
		//if no results, send empty array for view to deal with
		if(!matches)
			matches = [];

		returnData.matches = matches;
	}	

	return returnData;	
}

// Inputs
//   event_year
//   event_key
//   org_key
//   teams_list (comma-separated list of teams, red alliance first, use ",0" between red list and blue list)
//   cookies (from req.cookies)
// Returns a data blob containing the *starred* attributes:
//   teams: *teams*, {comma-separated list}
//   teamList: *teamList*, {split version of teams}
//   currentAggRanges: *currentAggRanges*,
//   avgdata: *avgTable*,
//   maxdata: *maxTable*
async function getAllianceStatsData( event_year, event_key, org_key, teams_list, cookies ) {
	var thisFuncName = "reports.getAllianceStatsData(): ";
	logger.info(thisFuncName + 'ENTER event_year=' + event_year + ',event_key=' + event_key + ',org_key=' + org_key + ',teams_list=' + teams_list);
	var returnData = {};

	var teams = teams_list;

	var teamList = teams.split(',');
	logger.debug(thisFuncName + 'teamList=' + JSON.stringify(teamList));

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	//var scorelayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting"}, {sort: {"order": 1}})
	var cookie_key = org_key + "_" + event_year + "_cols";
	var colCookie = cookies[cookie_key];
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
	// currentAggR = await utilities.find("currentaggranges", {}, {});
	var currentAggR = await utilities.find("aggranges", {"org_key": org_key, "event_key": event_key});
	var currentAggRanges = [];
	if (currentAggR)
		currentAggRanges = currentAggR;

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

module.exports = router;