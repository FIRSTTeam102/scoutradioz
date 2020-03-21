const router = require("express").Router();
const logger = require('log4js').getLogger('reports.js');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');

const {matchData: matchDataHelper, upload: uploadHelper} = require('@firstteam102/scoutradioz-helpers');

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

	var eventKey = req.event.key;

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	var rankings = await utilities.find("rankings", 
		{"event_key": eventKey}, 
		{sort:{rank: 1}}
	);

	res.render("./reports/rankings", {
		title: "Rankings",
		rankings: rankings
	});
}));

router.get("/finishedmatches", wrap(async (req, res) => {
	
	var thisFuncName = "reports.finishedmatches[get]: ";
	logger.info(thisFuncName + 'ENTER');
	var year = req.event.year;
	
	// for later querying by event_key
	var eventKey = req.event.key;
	logger.debug(thisFuncName + 'event_key=' + eventKey);

	// Match history info
	var matches = await utilities.find("matches", {"alliances.red.score": { $ne: -1}, "event_key" : eventKey}, {sort: {time: -1}});

	// Ranking point info
	var rankingPoints = await utilities.findOne("rankingpoints", {year: year});
	//logger.debug(thisFuncName + "rankingPoints=" + JSON.stringify(rankingPoints));
	
	//logger.debug(thisFuncName + 'matches=' + JSON.stringify(matches));
	res.render("./reports/finishedmatches", {
		title: "Matches",
		matches: matches,
		rankingPoints: rankingPoints
	});
}));

router.get("/upcoming", wrap(async (req, res) => {
	
	const thisFuncName = "reports.upcoming[GET]: ";
	logger.info(thisFuncName + "ENTER");

	var eventKey = req.event.key;
	var teamKey = req.query.team_key || 'all';
	// 2020-03-21 JL: Changed query.team to query.team_key

	// use helper function
	var upcomingData = await matchDataHelper.getUpcomingMatchData(eventKey, teamKey);
	
	var matches = upcomingData.matches;
	var teamRanks = upcomingData.teamRanks;
	//var teamNumbers = upcomingData.teamNumbers;
	
	// 2020-03-21 JL: Removed teamNumbers from locals (already set in usefunctions)
	//	+ renamed team to teamKey
	res.render('./reports/upcoming', {
		title: "Upcoming",
		matches: matches,
		teamRanks: teamRanks,
		teamKey: teamKey
	});
}));

router.get("/teamintel", wrap(async (req, res) => {
	
	var thisFuncName = "reports.teamintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var eventKey = req.event.key;
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	logger.debug(thisFuncName + "event_year=" + eventYear);
	
	var teamKey = req.query.team_key;
	if (!teamKey) throw Error("Please specify a team_key.");
	
	logger.debug(thisFuncName + 'teamKey=' + teamKey);
	
	
	// Team details
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	var team = await utilities.findOne("teams", 
		{ "key" : teamKey }, {},
		{allowCache: true}
	);
	
	if (!team) throw Error(`Team ${teamKey.substring(3)} does not exist or did not participate in this event.`);

	// Extract the current team ranking, etc.
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'
	var ranking = await utilities.findOne("rankings", 
		{"event_key": eventKey, "team_key": teamKey}, 
		{sort:{rank: 1}}
	);
	
	// Pit scouting info
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var pitFind = await utilities.findOne("pitscouting", 
		{ "org_key": orgKey, "event_key" : eventKey, "team_key" : teamKey }
	);
	var pitData = null;
	var pitData1 = null;
	if (pitFind)
		pitData = pitFind.data;
	// if (pitFind.data1)
	// 	pitData1 = pitFind.data1;
	
	// Pit data layout
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	var layout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: "pitscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);
	
	logger.trace(thisFuncName + 'layout=' + JSON.stringify(layout));
	
	// Pull in individual scouting data for this team, for this event, to enhance the match data
	logger.debug(thisFuncName + 'Pulling scoring data for teamKey=' + teamKey + ',event_key=' + eventKey);
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggFind = await utilities.find("matchscouting", {"org_key": orgKey, "team_key": teamKey, "event_key": eventKey}, {});
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
	var matches = await utilities.find("matches", 
		{"alliances.red.score": { $ne: -1}, "event_key" : eventKey, 
		$or: [{"alliances.blue.team_keys": teamKey}, {"alliances.red.team_keys": teamKey}]}, 
		{sort: {time: -1}}
	);
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

	// Ranking point info
	var rankingPoints = await utilities.findOne("rankingpoints", {year: eventYear});

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
	//var cookie_key = org_key + "_" + event_year + "_cols";
	//var colCookie = req.cookies[cookie_key];
	//var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	// 2020-03-07, M.O'C: Disabled filtered columns for this report
	var scorelayout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": orgKey, "event_key": eventKey, "team_key": teamKey } });
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
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});
	
	const images = await uploadHelper.findTeamImages(orgKey, eventYear, teamKey);
	
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
		images: images,
		rankingPoints: rankingPoints
	});
}));

router.get("/teamintelhistory", wrap(async (req, res) => {
	
	var thisFuncName = "reports.teamintelhistory*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team_key;
	if (!teamKey) throw Error("Please specify a team_key.");
	
	logger.debug(thisFuncName + 'teamKey=' + teamKey);
	
	// 2020-02-21, M.O'C: Fixed to be event year
	var eventYear = req.event.year;
	// need timestamp at 00:00 on Jan 1 for match querying - looking for matches where time > Jan 1. {year}
	var yearString = eventYear + '-01-01T00:00:00';
	var yearInt = new Date(yearString).getTime() / 1000;
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	
	// Team details
	var team = await utilities.findOne("teams", 
		{ "key" : teamKey }, {},
		{allowCache: true}
	);
	if(!team) throw Error(`Team ${teamKey.substring(3)} does not exist or did not participate in this event.`);
	
	//logger.debug(thisFuncName + 'team=' + JSON.stringify(team));

	// Pull in ALL individual scouting data for this team, for this event, to enhance the match data
	logger.debug(thisFuncName + 'Pulling scoring data for teamKey=' + teamKey);
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var aggFind = await utilities.find("matchscouting", {"org_key": orgKey, "team_key": teamKey, "year": eventYear}, {});
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
	var matches = await utilities.find("matches", 
		{"alliances.red.score": { $ne: -1}, "time": { $gt: yearInt}, 
		$or: [{"alliances.blue.team_keys": teamKey}, {"alliances.red.team_keys": teamKey}]}, 
		{sort: {time: -1}}
	);
	var eventKeys = {}, eventKeysArray = [];
	
	if (matches && matches.length > 0) {
		for (var match of matches) {
			//logger.debug(thisFuncName + 'For match ' + matches[matchesIdx].key);
			var thisScoreData = matchDataMap[match.key];
			if (thisScoreData)
			{
				//logger.debug(thisFuncName + 'Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
				match.scoringdata = thisScoreData;
			}
			// 2020-03-09 JL: get list of all events that these matches contain
			if (!eventKeys[match.event_key]) {
				eventKeys[match.event_key] = true;
			}
		}
	}
	// 2020-03-09 JL: Teamintelhistory previous matches section used to show event key.
	//		Edited to show event name instead.
	for (var key in eventKeys) {
		eventKeysArray.push(key);
	}
	var events = await utilities.find('events', 
		{key: {$in: eventKeysArray}}, {},
		{allowCache: true}
	);
	var eventInfos = {};
	for (var event of events){
		eventInfos[event.key] = {
			year: event.year,
			name: event.name
		}
	}
	
	// Ranking point info
	var rankingPoints = await utilities.findOne("rankingpoints", {year: eventYear});

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
	var cookie_key = orgKey + "_" + eventYear + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": orgKey, "team_key": teamKey, "year": eventYear } });
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
		year: eventYear,
		rankingPoints: rankingPoints,
		events: eventInfos,
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
	
	var match = await utilities.findOne("matches", 
		{"key": matchKey}, {},
		{allowCache: true, maxCacheAge: 10}
	);
	if (!match) throw Error(`Could not find match: ${matchKey}`);
	
	//logger.debug(thisFuncName + 'match=' + JSON.stringify(match));
	res.render("./reports/matchintel", {
		title: "Intel: Match "+matchKey.substring(matchKey.indexOf('qm')+2),
		match: match
	});
}));

router.get("/teammatchintel*", wrap(async (req, res) => {
	
	var thisFuncName = "reports.teammatchintel*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var matchTeamKey = req.query.key;
	if (!matchTeamKey) {
		res.redirect("/?alert=No team-match key specified in Team Match Intel page.");
		return;
	}
	logger.debug(thisFuncName + 'teamMatchKey=' + matchTeamKey);
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	
	// Match data layout
	var layout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	// 2020-03-06 JL: utilities.find -> utilities.findOne
	var teammatch = await utilities.findOne("matchscouting", {"org_key": orgKey, "match_team_key": matchTeamKey}, {});
	var data = null;
	if (teammatch) {
		data = teammatch.data;
	}
	
	var x = matchTeamKey;
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
		teamKey: matchTeamKey.split("_")[2],
		matchDataHelper: matchDataHelper
	});
}));

router.get("/alliancestats", wrap(async (req, res) =>  {
	
	var thisFuncName = "reports.alliancestats[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var eventYear = req.event.year;
	var eventKey = req.event.key;
	var orgKey = req.user.org_key;

	if( !req.query.teams ){
		return res.redirect("/?alert=Must specify comma-separated list of teams for reports/alliancestats");
	}
	var teams = req.query.teams;

	// use helper function
	var allianceStatsData = await matchDataHelper.getAllianceStatsData(eventYear, eventKey, orgKey, teams, req.cookies);
	
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
	
	// 2020-03-21 JL: Changed query.key to query.team_key
	var eventYear = req.event.year;
	var eventKey = req.event.key;
	var teamKey = req.query.team_key;
	var orgKey = req.user.org_key;
	
	if (!teamKey) throw Error("Must specify team key for reports/teamdata");
			
	logger.debug(`${thisFuncName} teamKey: ${teamKey}`);

	// get the specified team object
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	// 2020-03-06 JL: find -> findOne
	var team = await utilities.findOne("teams", 
		{"key": teamKey}, {},
		{allowCache: true}
	);
	
	if (!team) throw Error("Could not find team: " + teamKey);
	
	logger.debug(`${thisFuncName} team: ${JSON.stringify(team)}`);

	// get the scoring data for the matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var matches = await utilities.find("matchscouting", {"team_key": teamKey, "year": eventYear, "org_key": orgKey, "event_key": eventKey}, {sort: {"match_number": -1}});
	
	logger.trace(`${thisFuncName} matches: ${JSON.stringify(matches)}`);

	// get the scoring layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	var cookie_key = orgKey + "_" + eventYear + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	logger.trace(`${thisFuncName} scoreLayout: ${JSON.stringify(scoreLayout)}`);

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});
	
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
	
	var eventYear = req.event.year;
	var eventKey = req.event.key;
	var matchKey = req.query.key;
	var orgKey = req.user.org_key;

	if( !matchKey ){
		return res.redirect("/?alert=Must specify match key for reports/matchdata");
	}
	logger.debug(`${thisFuncName} matchKey: ${matchKey}`);

	// get the specified match object
	var match = await utilities.findOne("matches", {"key": matchKey}, {});
	if (!match) throw Error(`Could not find match: ${matchKey}`);
	
	logger.trace(`${thisFuncName} match: ${JSON.stringify(match)}`);

	// get the scoring data for the match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var matches = await utilities.find("matchscouting", {"org_key": orgKey, "match_key": matchKey}, {});
	
	logger.trace(`${thisFuncName} matches: ${JSON.stringify(matches)}`);

	// get the scoring layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	var cookie_key = orgKey + "_" + eventYear + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	logger.trace(`${thisFuncName} scoreLayout: ${JSON.stringify(scoreLayout)}`);

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});
	
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
	
	var eventYear = req.event.year;
	var eventKey = req.event.key;
	var matchKey = req.query.key;
	var orgKey = req.user.org_key;
	
	if( !matchKey ){
		return res.redirect("/?alert=Must specify match key for reports/matchmetrics");
	}
	logger.debug(`${thisFuncName} matchKey: ${matchKey}`);

	// get the specified match object
	var match = await utilities.findOne("matches", {"key": matchKey}, {}) || {};
	
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
	var cookie_key = orgKey + "_" + eventYear + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	var aggQuery = [];
	var redAllianceArray = match.alliances.red.team_keys;
	aggQuery.push({ $match : { "team_key": {$in: redAllianceArray}, "org_key": orgKey, "event_key": eventKey } });
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
	aggQuery.push({ $match : { "team_key": {$in: blueAllianceArray}, "org_key": orgKey, "event_key": eventKey } });
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
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});

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
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	var eventKey = req.event.key;

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
	// var cookie_key = org_key + "_" + event_year + "_cols";
	// var colCookie = req.cookies[cookie_key];
	// var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	// 2020-03-07, M.O'C: Disabled filtered columns for this report
	var scorelayout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": orgKey, "event_key": eventKey } });
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
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});
	
	res.render("./reports/metricsranked", {
		title: "Metrics For All Teams",
		currentAggRanges: currentAggRanges,
		aggdata: aggTable
	});
}));

router.get("/metrics", wrap(async (req, res) => {
	
	var thisFuncName = "reports.metrics[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	
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
	// var cookie_key = org_key + "_" + event_year + "_cols";
	// var colCookie = req.cookies[cookie_key];
	// var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	// 2020-03-07, M.O'C: Disabled filtered columns for this report
	var scorelayout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);

	var aggQuery = [];
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": orgKey, "event_key": event_key } });
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
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": event_key});
	
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
	var eventKey = req.event.key;
	var orgKey = req.user.org_key;
	logger.debug(thisFuncName + 'event_key=' + eventKey);

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
	aggQuery.push({ $match : { "data":{$exists:true}, "org_key": orgKey, "event_key": eventKey } });
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
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});
	
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
	var eventKey = req.event.key;
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	logger.debug(thisFuncName + 'event_key=' + eventKey);
	
	// get the current rankings
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	var rankings = await utilities.find("rankings", {"event_key": eventKey}, {});
	
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
	var cookie_key = orgKey + "_" + eventYear + "_cols";
	var colCookie = req.cookies[cookie_key];
	var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	// Build the aggregation data
	var aggQuery = [];
	aggQuery.push({ $match : { "org_key": orgKey, "event_key": eventKey } });
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
	var currentAggRanges = await utilities.find("aggranges", {"org_key": orgKey, "event_key": eventKey});
	
	res.render("./reports/allteammetrics", {
		title: "All Team Metrics",
		aggdata: aggArray,
		currentAggRanges: currentAggRanges,
		layout: scorelayout,
		matchDataHelper: matchDataHelper
	});
}));

//// 2020-03-07, M.O'C: TEMPORARY COPY-N-PASTE FROM /DASHBOARD SO UNAUTHENTICATED USERS CAN ACCESS

/**
 * Drive team dashboard view: Combination of [a] compare alliances and [b] upcoming matches
 * -- Pass in a team_key as 'team'
 * >> If null, use the organization's default; if no default, return nothing
 */
router.get("/driveteam", wrap(async (req, res) => {
	
	var thisFuncName = "reports.driveteam[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// for later querying by event_key
	var eventKey = req.event.key;
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	logger.debug(thisFuncName + 'event_key=' + eventKey);
	var teamKey;
	
	//set teamKey to query or org default
	if (req.query.team_key) {
		teamKey = req.query.team_key;
	}
	else if (req.user.org.team_key) {
		teamKey = req.user.org.team_key;
	}
	else {
		teamKey = 'all';
	}
	
	// Get upcoming match data for the specified team (or "all" if no default & none specified)
	var upcomingData = await matchDataHelper.getUpcomingMatchData(eventKey, teamKey);
	// Data for the upcoming matches portion
	var teamRanks = upcomingData.teamRanks;
	var teamNumbers = upcomingData.teamNumbers;
	
	// Prepare empty alliance stats data
	var teamList = null;
	var currentAggRanges = null;
	var avgTable = null;
	var maxTable = null;
	
	// Pull out the first match (if it exists), get the team keys from the alliances
	var matches = upcomingData.matches;
	if (matches && matches.length > 0) {
		var firstMatch = matches[0];

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

		// Get the alliance stats
		var allianceStatsData = await matchDataHelper.getAllianceStatsData(eventYear, eventKey, orgKey, teamKeyList, req.cookies);

		teams = allianceStatsData.teams;
		teamList = allianceStatsData.teamList;
		currentAggRanges = allianceStatsData.currentAggRanges;
		avgTable = allianceStatsData.avgTable;
		maxTable = allianceStatsData.maxTable;
		avgNorms = allianceStatsData.avgNorms;
		maxNorms = allianceStatsData.maxNorms;
		
	}

	var dataForChartJS = {
		labels: [],
		items: {
			red: [
				{
					label: teamList[0].substring(3),
					backgroundColor: 'rgba(255, 0, 0, 0.15)',
					borderColor: 'rgba(255, 0, 0, 0.7)'
				},
				{
					label: teamList[1].substring(3),
					backgroundColor: 'rgba(255, 128, 0, 0.15)',
					borderColor: 'rgba(255, 128, 0, 0.7)'
				},
				{
					label: teamList[2].substring(3),
					backgroundColor: 'rgba(255, 255, 0, 0.15)',
					borderColor: 'rgba(255, 255, 0, 0.7)'
				}
			],
			blue: [
				{
					label: teamList[4].substring(3),
					backgroundColor: 'rgba(63, 63, 255, 0.3)',
					borderColor: 'rgba(63, 63, 255, 1)'
				},
				{
					label: teamList[5].substring(3),
					backgroundColor: 'rgba(255, 0, 255, 0.15)',
					borderColor: 'rgba(255, 0, 255, 0.7)'
				},
				{
					label: teamList[6].substring(3),
					backgroundColor: 'rgba(0, 255, 255, 0.15)',
					borderColor: 'rgba(0, 255, 255, 0.7)'
				}
			]
		},
		datasets: {
			avg: {red: [], blue: []},
			max: {red: [], blue: []},
			sum: {red: [], blue: []},
		},
		options: {
			scale: {
				angleLines: {
					display: true
				},
				ticks: {
						showLabelBackdrop: false,
					suggestedMin: 0,
					suggestedMax: 1,
					display: false
				},
				angleLines: {
					color: 'rgb(128, 128, 128)'
				},
				gridLines: {
					color: 'rgb(64, 64, 64)'
				}
			}
		}
	};
	
	for (var i in dataForChartJS.datasets) {
		var set = dataForChartJS.datasets[i];
		for (var i = 0; i < 3; i++ ) {
			set.red[i] = [];
			set.blue[i] = [];
		}
	}
	
	//Populate labels array
	for (var agg of avgTable) {
		if (agg.hasOwnProperty('key')) {
			var text = agg.key.replace( /([A-Z])/g, " $1" ); 
			var label = (text.charAt(0).toUpperCase() + text.slice(1)).split(' ');
			dataForChartJS.labels.push(label);
		}
	}
	
	//Avg norms
	for (var agg of avgNorms) {
		for (var i in teamList) {
			var team = teamList[i];
			if (agg.hasOwnProperty(team)) {
				//red
				if (i < 3) {
					var thisDatum = agg[team];
					dataForChartJS.datasets.avg.red[i].push(thisDatum);
				}
				//blue
				else {
					var thisDatum = agg[team];
					dataForChartJS.datasets.avg.blue[i - 4].push(thisDatum);
				}
			}
		}
	}
	//Max norms
	for (var agg of maxNorms) {
		for (var i in teamList) {
			var team = teamList[i];
			if (agg.hasOwnProperty(team)) {
				//red
				if (i < 3) {
					var thisDatum = agg[team];
					dataForChartJS.datasets.max.red[i].push(thisDatum);
				}
				//blue
				else {
					var thisDatum = agg[team];
					dataForChartJS.datasets.max.blue[i - 4].push(thisDatum);
				}
			}
		}
	}
	//console.log(avgNorms);
	//console.log(teamList);
	//console.log(JSON.stringify(dataForChartJS, 0, 2));
	
	
	res.render("./dashboard/drive", {
		title: "Drive Team Dashboard",
		teamList: teamList,
		currentAggRanges: currentAggRanges,
		avgdata: avgTable,
		maxdata: maxTable,
		avgnorms: avgNorms,
		maxnorms: maxNorms,
		matches: matches,
		teamRanks: teamRanks,
		selectedTeam: teamKey,
		teamNumbers: teamNumbers,
		dataForChartJS: JSON.stringify(dataForChartJS)
	});
}));

//// Data exports

router.get("/exportdata", wrap(async (req, res) => {
	
	var thisFuncName = "reports.exportdata[get]: ";

	// for later querying by event_key
	var eventKey = req.event.key;
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;

	var dataType = req.query.type;
	if (!dataType) {
		res.redirect("/?alert=No data type specified for export.");
		return;
	}

	logger.info(thisFuncName + 'ENTER event_key=' + eventKey + ',org_key=' + orgKey + ',data_type=' + dataType + ',req.shortagent=' + JSON.stringify(req.shortagent));

	// read in the list of form options
	var matchLayout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: dataType}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);

	// sanity check
	//logger.debug(thisFuncName + "layout=" + JSON.stringify(matchLayout));
	if (!matchLayout || matchLayout.length == 0) {
		res.redirect("/?alert=No data found for type '" + dataType + "'.");
		return;
	}

	var sortKey = "";
	switch (dataType) {
		case 'matchscouting':
			sortKey = "time";
			break;
		case 'pitcouting':
			sortKey = "team_key";
			break;
	}

	// read in all data
	var scored = await utilities.find(dataType, {"org_key": orgKey, "event_key": eventKey, "data": {$exists: true} }, { sort: {sortKey: 1} });

	// cycle through each scored match & build CSV
	var fullCSVoutput = "";
	// which 'pivot data columns' are we including?
	var pivotDataCols = "";
	switch (dataType) {
		case 'matchscouting':
			pivotDataCols = "org_key,year,event_key,match_key,match_number,time,alliance,team_key";
			break;
		case 'pitscouting':
			pivotDataCols = "org_key,year,event_key,team_key";
			break;
		default:
			pivotDataCols = "";
	}
	var pivotDataKeys = pivotDataCols.split(",");
	var isFirstRow = true;
	for (var i in scored) {
		var thisScored = scored[i];
		//logger.debug(thisFuncName + "thisScored=" + JSON.stringify(thisScored));
		// should be redundant with the "$exists: true" in the DB find query, BUT... just in case...
		if (thisScored.data) {
			// emit header row if this is the first line of data
			if (isFirstRow) {
				isFirstRow = false;
				// initialize header row with particular columns
				var headerRow = pivotDataCols;
				// add on metric IDs
				for (var j in matchLayout) {
					var thisItem = matchLayout[j];
					
					if (matchDataHelper.isMetric(thisItem.type)) 
						headerRow += "," + thisItem.id;
				}
				//logger.debug(thisFuncName + "headerRow=" + headerRow);
				fullCSVoutput = headerRow;
			}

			var dataRow = "";
			var thisData = thisScored.data;
			
			// initialize data row with particular columns
			var isFirstColumn = true;
			for (var k in pivotDataKeys) {
				if (isFirstColumn)
					isFirstColumn = false;
				else
					dataRow += ",";
				var thisPivotDataKey = pivotDataKeys[k];
				var thisVal = thisScored[thisPivotDataKey];
				// 2020-03-11 JL: time now exports to date stringj
				//If this value is a time, then convert it into a Date string
				if (thisPivotDataKey == 'time') {
					thisVal = new Date(thisVal * 1000).toLocaleString().replace(', ', ' ');
				}
				//Convert value into a string
				thisVal = "" + thisVal;
				//Add to dataRow
				dataRow += thisVal.replace(/(\r\n|\n|\r)/gm,"");
			}

			// cycle through the metrics
			for (var j in matchLayout) {
				var thisItem = matchLayout[j];

				if (matchDataHelper.isMetric(thisItem.type)) {
					dataRow += ",";

					if (thisData[thisItem.id] || thisData[thisItem.id] == 0) {
						var thisVal = "" + thisData[thisItem.id];
						dataRow += '"' + thisVal.replace(/(\r\n|\n|\r)/gm,"") + '"';
					}
				}
			}
			//logger.debug(thisFuncName + "dataRow=" + dataRow);
			fullCSVoutput += "\n" + dataRow;
		}
	}	

	logger.info(thisFuncName + "EXIT returning " + scored.length + " rows of CSV");

	// Send back simple text
	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename=\"' + dataType + '_' + orgKey + '_' + eventKey + '_' + Date.now() + '.csv\"');
	return res.send(fullCSVoutput);
}));

//// Choosing & setting scoring selections

router.get("/choosecolumns", wrap(async (req, res) =>  {
	var thisFuncName = "reports.choosecolumns[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;

	// read in the list of form options
	var matchlayout = await utilities.find("layout", 
		{org_key: orgKey, year: eventYear, form_type: "matchscouting"}, 
		{sort: {"order": 1}},
		{allowCache: true}
	);
	//logger.debug(thisFuncName + "matchlayout=" + JSON.stringify(matchlayout))

	var cookie_key = orgKey + "_" + eventYear + "_cols";
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
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
	var cookieKey = orgKey + "_" + eventYear + "_cols";

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

	res.cookie(cookieKey, columnCookie, {maxAge: 30E9});
	
	// setting org defaults? NOTE only for Team Admins and above
	if (setOrgDefault && req.user.role.access_level >= process.env.ACCESS_TEAM_ADMIN) {
		logger.debug(thisFuncName + "Setting org defaults");
		var thisOrg = await utilities.findOne("orgs", 
			{org_key: orgKey}, {},
			{allowCache: true}
		);
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
		theseColDefaults[eventYear] = columnCookie;
		
		// update DB
		await utilities.update("orgs", {org_key: orgKey}, {$set: {"config.columnDefaults": theseColDefaults}});

		//logger.debug(thisFuncName + "thisOrg=" + JSON.stringify(thisOrg));
	}

	res.redirect("../home");
}));

router.post("/clearorgdefaultcols", wrap(async (req, res) => {
	var thisFuncName = "reports.clearorgdefaultcols[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;

	if (req.user.role.access_level >= process.env.ACCESS_TEAM_ADMIN) {
		var thisOrg = await utilities.findOne("orgs", 
			{org_key: orgKey}, {},
			{allowCache: true}
		);
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
		delete theseColDefaults[eventYear];

		// update DB
		await utilities.update("orgs", {org_key: orgKey}, {$set: {"config.columnDefaults": theseColDefaults}});
	}

	res.redirect("../home");
}));

module.exports = router;