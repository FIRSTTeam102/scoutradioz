var express = require("express");
var router = express.Router();
var utilities = require('../utilities');

router.get("/", function(req, res){

	// TODO - we should probaby make an index for reports?
	res.redirect('/?alert=No index page for /reports/');
	
});

router.get("/rankings", async function(req, res){
	var thisFuncName = "reports.rankings[get]: ";
	res.log(thisFuncName + 'ENTER');

	var rankings = await utilities.find("currentrankings", {}, {sort:{rank: 1}});
	if (!rankings)
		rankings = [];
	console.log("DEBUG - reports.js - get(/rankings) - rankings=" + rankings);

	res.render("./reports/rankings", {
		title: "Rankings",
		rankings: rankings
	});
});

router.get("/finishedmatches", function(req, res){
	var thisFuncName = "reports.finishedmatches[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var currentCol = db.get("current");
	var matchCol = req.db.get('matches');
	
	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			res.render('/adminindex', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// for later querying by event_key
		var event_key = eventId;
		res.log(thisFuncName + 'event_key=' + event_key);

		// Match history info
		matchCol.find({"alliances.red.score": { $ne: -1}, "event_key" : event_key}, {sort: {time: -1}}, function (e, docs) {
			var matches = docs;
			//res.log(thisFuncName + 'matches=' + JSON.stringify(matches));
			res.render("./reports/finishedmatches", {
				title: "Matches",
				matches: matches
			});
		});			
	});
});

router.get("/upcoming", function(req, res){
	
	//check if the page queried a specific team for upcoming
	if(!req.query || !req.query.team)
		var teamKey = 'all';
	else
		var teamKey = req.query.team;
	
	//get our collections
	var matchesCol = req.db.get("matches");
	var currentrankings = req.db.get("currentrankings");
	var currentteams = req.db.get("currentteams");
	var teamRanks = {};
	
	//get list of teams for this event
	currentteams.find({},{sort: {team_number: 1}}, function(e, teams){
		
		//get list of just team numbers
		var teamNumbers = [];
		
		for(var i in teams){
			teamNumbers[i] = teams[i].team_number;
		}
		
		//get rankings for this event
		currentrankings.find({},{sort: {rank: 1}}, function(e, rankings){
			
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
				matchesCol.find(query, {sort: {time: 1}}, function(e, matches){
					
					if(e)
						return res.log(e);
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
				});
			}
			//if teamKey is 'all'
			else{
				//find all matches for this event that have not been completed
				matchesCol.find({event_key: req.event.key, "alliances.blue.score": -1}, {sort: {time: 1}}, function(e, matches){
					if(e)
						return res.log(e);
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
				});
			}	
		});
	});
	
});

router.get("/teamintel", function(req, res){
	var thisFuncName = "reports.teamintel*[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/?alert=No team specified in Reports page.");
		return;
	}
	res.log(thisFuncName + 'teamKey=' + teamKey);
	
	var db = req.db;
	var rankCol = db.get("currentrankings");
	var teamsCol = req.db.get('currentteams');
	var pitCol = req.db.get('scoutingdata');
	var aggCol = req.db.get('scoringdata');
	var matchCol = req.db.get('matches');
	var scoutCol = db.get("scoutinglayout");
	var scoreCol = db.get("scoringlayout");
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	var event_key = req.event.key;
	var event_year = req.event.year;
	res.log(event_year);
	
	// Team details
	teamsCol.find({ "key" : teamKey }, {}, function(e, docs){
		if(e)
			return console.error(e);
		if(!docs[0]){
			return res.render('./error', {
				title: "Intel: Team " + teamKey.substring(3),
				error: {
					status: "FRC Team "+teamKey.substring(3)+" does not exist or did not participate in this event."
				}
			});
		}
		var team = docs[0];

		// Extract the current team ranking, etc.
		rankCol.find({team_key: teamKey}, {sort: {rank: 1}}, function(e, docs) {
			var ranking = null;
			if (docs && docs.length > 0)
				ranking = docs[0];
		
			// Pit scouting info
			pitCol.find({ "event_key" : event_key, "team_key" : teamKey }, {}, function(e, docs){
				var pitData = null;
				var pitData1 = null;
				if (docs && docs[0]) {
					if (docs[0].data)
						pitData = docs[0].data;
					if (docs[0].data1)
						pitData1 = docs[0].data1;
				}
				//res.log(thisFuncName + 'pitData=' + JSON.stringify(pitData));
			
				// Pit data layout
				scoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
					var layout = docs;
					//res.log(thisFuncName + 'layout=' + JSON.stringify(layout));
					
					// Pull in individual scouting data for this team, for this event, to enhance the match data
					res.log(thisFuncName + 'Pulling scoring data for teamKey=' + teamKey + ',event_key=' + event_key);
					aggCol.find({"team_key": teamKey, "event_key": event_key}, {}, function (e, docs) {
						// Build a map of match_key->data
						var matchDataMap = {};
						if (docs && docs.length > 0) {
							for (var mDMidx = 0; mDMidx < docs.length; mDMidx++) {
								var thisTeamMatch = docs[mDMidx];
								//res.log(thisFuncName + 'Match scouting data for thisTeamMatch.match_key=' + thisTeamMatch.match_key);
								if (thisTeamMatch.data)
								{
									//res.log(thisFuncName + 'Adding data to map');
									matchDataMap[thisTeamMatch.match_key] = thisTeamMatch.data;
								}
							}
						}
								
						// Match history info
						matchCol.find({"alliances.red.score": { $ne: -1}, "event_key" : event_key, $or: [{"alliances.blue.team_keys": teamKey}, {"alliances.red.team_keys": teamKey}]}, {sort: {time: -1}}, function (e, docs) {
							var matches = docs;
							if (matches && matches.length > 0) {
								for (var matchesIdx = 0; matchesIdx < matches.length; matchesIdx++) {
									//res.log(thisFuncName + 'For match ' + matches[matchesIdx].key);
									var thisScoreData = matchDataMap[matches[matchesIdx].key];
									if (thisScoreData)
									{
										//res.log(thisFuncName + 'Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
										matches[matchesIdx].scoringdata = thisScoreData;
									}
								}
							}
							//res.log(thisFuncName + 'matches=' + JSON.stringify(matches));
					
							// Match data layout - use to build dynamic Mongo aggregation query
							// db.scoringdata.aggregate( [ 
							// { $match : { "data":{$exists:true}, "event_key": "2018njfla", "team_key": "frc303" } }, 
							// { $group : { _id: "$team_key",
							// "teleScaleMIN": {$min: "$data.teleScale"},
							// "teleScaleAVG": {$avg: "$data.teleScale"},
							// "teleScaleMAX": {$max: "$data.teleScale"}
							//  } }
							// ] );						
							scoreCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
								var scorelayout = docs;
								var aggQuery = [];
								aggQuery.push({ $match : { "data":{$exists:true}, "event_key": event_key, "team_key": teamKey } });
								var groupClause = {};
								groupClause["_id"] = "$team_key";

								for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
									var thisLayout = scorelayout[scoreIdx];
									if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
										//res.log(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
										groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
										groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
										groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
										groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
									}
								}
								aggQuery.push({ $group: groupClause });
								//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
								
								aggCol.aggregate(aggQuery, function(e, docs){
									var aggresult = {};
									if (docs && docs[0])
										aggresult = docs[0];
									//res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

									// Unspool single row of aggregate results into tabular form
									var aggTable = [];
									for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
										var thisLayout = scorelayout[scoreIdx];
										if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
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
									//res.log(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));

									//res.log(thisFuncName + 'pitData=' + JSON.stringify(pitData));
									//res.log(thisFuncName + 'pitData1=' + JSON.stringify(pitData1));

									// read in the current agg ranges
									currentAggCol.find({}, {}, function (e, docs) {
										var currentAggRanges = [];
										if (docs)
											currentAggRanges = docs;

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
											matches: matches
										});
									});
								});
							});
						});
					});
				});
			});
		});
	});
});

router.get("/teamintelhistory", function(req, res){
	var thisFuncName = "reports.teamintelhistory*[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/?alert=No team specified in Reports page.");
		return;
	}
	res.log(thisFuncName + 'teamKey=' + teamKey);
	
	// need the current year to see data
	var year = (new Date()).getFullYear();
	// need timestamp at 00:00 on Jan 1 for match querying - looking for matches where time > Jan 1. {year}
	var yearString = year + '-01-01T00:00:00';
	var yearInt = new Date(yearString).getTime() / 1000;
	
	var db = req.db;
	var teamsCol = req.db.get('teams');
	var aggCol = req.db.get('scoringdata');
	var matchCol = req.db.get('matches');
	var scoreCol = db.get("scoringlayout");

	var event_year = req.event.year;
	
	// Team details
	teamsCol.find({ "key" : teamKey }, {}, function(e, docs){
		if(e)
			return console.error(e);
		if(!docs[0]){
			return res.render('./error', {
				title: "Intel: Team " + teamKey.substring(3),
				error: {
					status: "FRC Team "+teamKey.substring(3)+" does not exist or did not participate in this event."
				}
			});
		}
		var team = docs[0];
		//res.log(thisFuncName + 'team=' + JSON.stringify(team));

		// Pull in ALL individual scouting data for this team, for this event, to enhance the match data
		res.log(thisFuncName + 'Pulling scoring data for teamKey=' + teamKey);
		aggCol.find({"team_key": teamKey, "year": year}, {}, function (e, docs) {
			// Build a map of match_key->data
			var matchDataMap = {};
			if (docs && docs.length > 0) {
				for (var mDMidx = 0; mDMidx < docs.length; mDMidx++) {
					var thisTeamMatch = docs[mDMidx];
					//res.log(thisFuncName + 'Match scouting data for thisTeamMatch.match_key=' + thisTeamMatch.match_key);
					if (thisTeamMatch.data)
					{
						//res.log(thisFuncName + 'Adding data to map');
						matchDataMap[thisTeamMatch.match_key] = thisTeamMatch.data;
					}
				}
			}

			// ALL Match history info
			var yearMatch = year + '/';
			matchCol.find({"alliances.red.score": { $ne: -1}, "time": { $gt: yearInt}, $or: [{"alliances.blue.team_keys": teamKey}, {"alliances.red.team_keys": teamKey}]}, {sort: {time: -1}}, function (e, docs) {
				var matches = docs;
				if (matches && matches.length > 0) {
					for (var matchesIdx = 0; matchesIdx < matches.length; matchesIdx++) {
						//res.log(thisFuncName + 'For match ' + matches[matchesIdx].key);
						var thisScoreData = matchDataMap[matches[matchesIdx].key];
						if (thisScoreData)
						{
							//res.log(thisFuncName + 'Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
							matches[matchesIdx].scoringdata = thisScoreData;
						}
					}
				}
				//res.log(thisFuncName + 'matches=' + JSON.stringify(matches));
		
				// Match data layout - use to build dynamic Mongo aggregation query
				// db.scoringdata.aggregate( [ 
				// { $match : { "data":{$exists:true}, "team_key": "frc303" } },    <- No event; avg across ALL events
				// { $group : { _id: "$team_key",
				// "teleScaleMIN": {$min: "$data.teleScale"},
				// "teleScaleAVG": {$avg: "$data.teleScale"},
				// "teleScaleMAX": {$max: "$data.teleScale"}
				//  } }
				// ] );						
				scoreCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
					var scorelayout = docs;
					var aggQuery = [];
					aggQuery.push({ $match : { "data":{$exists:true}, "team_key": teamKey, "year": year } });
					var groupClause = {};
					groupClause["_id"] = "$team_key";

					for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
						var thisLayout = scorelayout[scoreIdx];
						if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
							//res.log(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
							groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
							groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
							groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
							groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
						}
					}
					aggQuery.push({ $group: groupClause });
					//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
					
					aggCol.aggregate(aggQuery, function(e, docs){
						var aggresult = {};
						if (docs && docs[0])
							aggresult = docs[0];
						//res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

						// Unspool single row of aggregate results into tabular form
						var aggTable = [];
						for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
							var thisLayout = scorelayout[scoreIdx];
							if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
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
						//res.log(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));

						//res.log(thisFuncName + 'pitData=' + JSON.stringify(pitData));
						//res.log(thisFuncName + 'pitData1=' + JSON.stringify(pitData1));

						res.render("./reports/teamintelhistory", {
							title: "Intel History: Team " + teamKey.substring(3),
							team: team,
							scorelayout: scorelayout,
							aggdata: aggTable,
							matches: matches
						});
					});
				});
			});
		});
	});
});

router.get("/matchintel*", function(req, res){
	var thisFuncName = "reports.matchintel*[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var matchKey = req.query.key;
	if (!matchKey) {
		res.redirect("/?alert=No match key specified in Match Intel page.");
		return;
	}
	res.log(thisFuncName + 'matchKey=' + matchKey);
	
	var db = req.db;
	var matchCol = req.db.get('matches');
	//var teamsCol = req.db.get('teams');
	//var pitCol = req.db.get('scoutingdata');
	//var currentCol = db.get("current");
	//var scoutCol = db.get("scoutinglayout");
	
	matchCol.find({"key": matchKey}, {}, function (e, docs) {
		var match = {};
		if (docs && docs[0])
			match = docs[0];
		
		//res.log(thisFuncName + 'match=' + JSON.stringify(match));
		res.render("./reports/matchintel", {
			title: "Intel: Match "+matchKey.substring(matchKey.indexOf('qm')+2),
			match: match
		});
	});
});

router.get("/teammatchintel*", function(req, res){
	var thisFuncName = "reports.teammatchintel*[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var match_team_key = req.query.key;
	if (!match_team_key) {
		res.redirect("/?alert=No team-match key specified in Team Match Intel page.");
		return;
	}
	res.log(thisFuncName + 'teamMatchKey=' + match_team_key);
	
	var db = req.db;
	var scoringDataCol = req.db.get('scoringdata');
	//var teamsCol = req.db.get('teams');
	//var pitCol = req.db.get('scoutingdata');
	//var currentCol = db.get("current");
	var scoringLayoutCol = db.get("scoringlayout");

	var event_year = req.event.year;
	
	// Match data layout
	scoringLayoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
		var layout = docs;
		
		scoringDataCol.find({"match_team_key": match_team_key}, {}, function (e, docs) {
			var data = null;
			var teammatch = null;
			if (docs && docs[0]) {
				teammatch = docs[0];
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
			
			
			//res.log(thisFuncName + 'teammatch=' + JSON.stringify(teammatch));
			res.render("./reports/teammatchintel", {
				title: `Intel: ${matchType} ${matchNum} Team ${teamNum}`,
				layout: layout,
				data: data,
				teammatch: teammatch,
				teamKey: match_team_key.split("_")[2]
			});
		});
	});
});

router.get("/alliancestats", function(req, res) {
	var thisFuncName = "reports.alliancestats[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var scoringLayoutCol = db.get("scoringlayout");
	var currentCol = db.get("current");
	var matchCol = db.get('matches');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var event_key = req.event.key;

	if( !req.query.teams ){
		return res.redirect("/?alert=Must specify comma-separated list of teams for reports/alliancestats");
	}
	var teams = req.query.teams;
	var teamList = req.query.teams.split(',');
	res.log(thisFuncName + 'teamList=' + JSON.stringify(teamList));

	scoringLayoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
		var scorelayout = docs;
		var aggQuery = [];
		aggQuery.push({ $match : { "team_key": {$in: teamList}, "event_key": event_key } });
		var groupClause = {};
		// group by individual teams
		groupClause["_id"] = "$team_key";

		for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			var thisLayout = scorelayout[scoreIdx];
			if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
			{
				groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
				groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
			}
		}
		aggQuery.push({ $group: groupClause });
		res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
		
		aggCol.aggregate(aggQuery, function(e, docs){
			var aggresult = {};
			if (docs)
				aggresult = docs;
			res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

			// Build a map of the result rows by team key
			var aggRowsByTeam = {};
			for (var resultIdx = 0; resultIdx < aggresult.length; resultIdx++)
				aggRowsByTeam[ aggresult[resultIdx]["_id"] ] = aggresult[resultIdx];
			res.log( thisFuncName + 'aggRowsByTeam[' + teamList[0] + ']=' + JSON.stringify(aggRowsByTeam[teamList[0]]) );

			// Unspool N rows of aggregate results into tabular form
			var avgTable = [];
			var maxTable = [];

			for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
				var thisLayout = scorelayout[scoreIdx];
				if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
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
			res.log(thisFuncName + 'avgTable=' + JSON.stringify(avgTable));
			res.log(thisFuncName + 'maxTable=' + JSON.stringify(maxTable));

			// read in the current agg ranges
			currentAggCol.find({}, {}, function (e, docs) {
				var currentAggRanges = [];
				if (docs)
					currentAggRanges = docs;

				res.render("./reports/alliancestats", {
					title: "Alliance Team Statistics",
					teams: teams,
					teamList: teamList,
					currentAggRanges: currentAggRanges,
					avgdata: avgTable,
					maxdata: maxTable
				});
			});
		});
	});
});

router.get("/teamdata", function(req, res) {
	var thisFuncName = "reports.teamdata[get]: ";
	res.log(thisFuncName + 'ENTER');

	var db = req.db;
	var scoringCol = req.db.get('scoringdata');
	var scoringLayoutCol = db.get("scoringlayout");
	var currentAggCol = db.get("currentaggranges");
	var teamCol = db.get('currentteams');

	var event_year = req.event.year;
	var event_key = req.event.key;
	var teamKey = req.query.key;

	if( !teamKey ){
		return res.redirect("/?alert=Must specify team key for reports/teamdata");
	}
	res.log(`${thisFuncName} teamKey: ${teamKey}`);

	// get the specified team object
	teamCol.find({"key": teamKey}, {}, function (e, docs) {
		var team = {};
		if (docs && docs[0])
			team = docs[0];
			
		res.log(`${thisFuncName} team: ${JSON.stringify(team)}`);
	
		// get the scoring data for the matches
		scoringCol.find({"team_key": teamKey, "year": event_year, "event_key": event_key}, {sort: {"match_number": -1}}, function (e, docs) {
			var matches = [];
			if (docs)
				matches = docs;

			res.log(`${thisFuncName} matches: ${JSON.stringify(matches)}`);

			// get the scoring layout
			scoringLayoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
				var scoreLayout = docs;

				res.log(`${thisFuncName} scoreLayout: ${JSON.stringify(scoreLayout)}`);

				// read in the current agg ranges
				currentAggCol.find({}, {}, function (e, docs) {
					var currentAggRanges = [];
					if (docs)
						currentAggRanges = docs;

					res.render("./reports/teamdata", {
						title: "Scoring Data For Team",
						layout: scoreLayout,
						currentAggRanges: currentAggRanges,
						matches: matches,
						team: team
					});
				});
			});			
		});
	});
});

router.get("/matchdata", function(req, res) {
	var thisFuncName = "reports.matchdata[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var scoringCol = req.db.get('scoringdata');
	var scoringLayoutCol = db.get("scoringlayout");
	var currentAggCol = db.get("currentaggranges");
	var matchCol = db.get('matches');

	var event_year = req.event.year;
	var event_key = req.event.key;
	var matchKey = req.query.key;

	if( !matchKey ){
		return res.redirect("/?alert=Must specify match key for reports/matchdata");
	}
	res.log(`${thisFuncName} matchKey: ${matchKey}`);

	// get the specified match object
	matchCol.find({"key": matchKey}, {}, function (e, docs) {
		var match = {};
		if (docs && docs[0])
			match = docs[0];
			
		res.log(`${thisFuncName} match: ${JSON.stringify(match)}`);
	
		// get the scoring data for the match
		scoringCol.find({"match_key": matchKey}, {}, function (e, docs) {
			var matches = [];
			if (docs)
				matches = docs;

			res.log(`${thisFuncName} matches: ${JSON.stringify(matches)}`);

			// get the scoring layout
			scoringLayoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
				var scoreLayout = docs;

				res.log(`${thisFuncName} scoreLayout: ${JSON.stringify(scoreLayout)}`);

				// read in the current agg ranges
				currentAggCol.find({}, {}, function (e, docs) {
					var currentAggRanges = [];
					if (docs)
						currentAggRanges = docs;

					res.render("./reports/matchdata", {
						title: "Scoring Data For Match",
						scoreLayout: scoreLayout,
						currentAggRanges: currentAggRanges,
						matches: matches,
						match: match
					});
				});
			});			
		});
	});
});

router.get("/matchmetrics", function(req, res) {
	var thisFuncName = "reports.matchmetrics[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var scoringLayoutCol = db.get("scoringlayout");
	var currentCol = db.get("current");
	var matchCol = db.get('matches');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	var matchKey = req.query.key;
	
	if( !matchKey ){
		return res.redirect("/?alert=Must specify match key for reports/matchmetrics");
	}
	res.log(`${thisFuncName} matchKey: ${matchKey}`);

	// get the specified match object
	matchCol.find({"key": matchKey}, {}, function (e, docs) {
		var match = {};
		if (docs && docs[0])
			match = docs[0];
			
		res.log(`${thisFuncName} match: ${JSON.stringify(match)}`);

		// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
		// db.scoringdata.aggregate( [ 
		// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
		// { $group : { _id: "$event_key",
		// "autoScaleAVG": {$avg: "$data.autoScale"},
		// "teleScaleAVG": {$avg: "$data.teleScale"},
		//  } }
		// ] );
		scoringLayoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
			var scorelayout = docs;
			var aggQuery = [];
			var redAllianceArray = match.alliances.red.team_keys;
			aggQuery.push({ $match : { "team_key": {$in: redAllianceArray}, "event_key": event_key } });
			var groupClause = {};
			// group teams for 1 row per event (we're doing this twice, once for red & once for blue)
			groupClause["_id"] = "$event_key";

			for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
				var thisLayout = scorelayout[scoreIdx];
				if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
					groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
			}
			aggQuery.push({ $group: groupClause });
			//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
			
			aggCol.aggregate(aggQuery, function(e, docs){
				var aggresult = {};
				if (docs && docs[0])
					aggresult = docs[0];
				//res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

				// Unspool single row of aggregate results into tabular form
				var aggTable = [];
				for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
					var thisLayout = scorelayout[scoreIdx];
					if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
						var aggRow = {};
						aggRow['key'] = thisLayout.id;
						aggRow['red'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
						aggTable.push(aggRow);
					}
				}

				// repeat aggregation for blue alliance
				aggQuery = [];
				var blueAllianceArray = match.alliances.blue.team_keys;
				aggQuery.push({ $match : { "team_key": {$in: blueAllianceArray}, "event_key": event_key } });
				// reuse prior groupClause
				aggQuery.push({ $group: groupClause });
				//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
			
				aggCol.aggregate(aggQuery, function(e, docs){
					aggresult = {};
					if (docs && docs[0])
						aggresult = docs[0];
					//res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

					// Unspool single row of aggregate results into tabular form
					// Utilize pointer to aggTable to line up data
					var aggTablePointer = 0;
					for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
						var thisLayout = scorelayout[scoreIdx];
						if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
							aggTable[aggTablePointer].blue = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
							aggTablePointer++;
						}
					}
				
					res.log(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));
				
					// read in the current agg ranges
					currentAggCol.find({}, {}, function (e, docs) {
						var currentAggRanges = [];
						if (docs)
							currentAggRanges = docs;

						res.render("./reports/matchmetrics", {
							title: "Metrics For Upcoming Match",
							aggdata: aggTable,
							currentAggRanges: currentAggRanges,
							match: match
						});
					});
				});
			});
		});
	});
});

router.get("/metricsranked", function(req, res){
	var thisFuncName = "reports.metricsranked[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var scoreCol = db.get("scoringlayout");
	var currentCol = db.get("current");
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;

	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			res.render('/adminindex', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// for later querying by event_key
		var event_key = eventId;
		res.log(thisFuncName + 'event_key=' + event_key);
	
		// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will combo ALL teams
		// db.scoringdata.aggregate( [ 
		// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
		// { $group : { _id: "$team_key",
		// "teleScaleMIN": {$min: "$data.teleScale"},
		// "teleScaleAVG": {$avg: "$data.teleScale"},
		// "teleScaleMAX": {$max: "$data.teleScale"}
		//  } }
		// ] );						
		scoreCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
			var scorelayout = docs;
			var aggQuery = [];
			aggQuery.push({ $match : { "data":{$exists:true}, "event_key": event_key } });
			var groupClause = {};
			// group teams for 1 row per team
			groupClause["_id"] = "$team_key";

			for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
				var thisLayout = scorelayout[scoreIdx];
				if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
					//res.log(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
					//groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
					groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
					//groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
					//groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
				}
			}
			aggQuery.push({ $group: groupClause });
			//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
			
			aggCol.aggregate(aggQuery, function(e, docs){
				var aggData = [];
				//var aggresult = {};
				if (docs)
					aggData = docs;
					//aggresult = docs[0];
				//res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

				// Unspool rows of aggregate results into tabular form - update values as higher values found
				var aggTable = [];
				for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
					var thisLayout = scorelayout[scoreIdx];
					if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
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
				res.log(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));
				
				// read in the current agg ranges
				currentAggCol.find({}, {}, function (e, docs) {
					var currentAggRanges = [];
					if (docs)
						currentAggRanges = docs;

					res.render("./reports/metricsranked", {
						title: "Metrics For All Teams",
						currentAggRanges: currentAggRanges,
						aggdata: aggTable
					});
				});
			});
		});
	});	
});

router.get("/metrics", function(req, res){
	var thisFuncName = "reports.metrics[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var scoreCol = db.get("scoringlayout");
	var currentCol = db.get("current");
	var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;

	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			res.render('/adminindex', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// for later querying by event_key
		var event_key = eventId;
		res.log(thisFuncName + 'event_key=' + event_key);
	
		// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will combo ALL teams
		// db.scoringdata.aggregate( [ 
		// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
		// { $group : { _id: "$team_key",
		// "teleScaleMIN": {$min: "$data.teleScale"},
		// "teleScaleAVG": {$avg: "$data.teleScale"},
		// "teleScaleMAX": {$max: "$data.teleScale"}
		//  } }
		// ] );						
		scoreCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
			var scorelayout = docs;
			var aggQuery = [];
			aggQuery.push({ $match : { "data":{$exists:true}, "event_key": event_key } });
			var groupClause = {};
			// group on event for single row
			groupClause["_id"] = "$event_key";

			for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
				var thisLayout = scorelayout[scoreIdx];
				if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
					//res.log(thisFuncName + 'thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
					groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
					groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
					groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
					groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
				}
			}
			aggQuery.push({ $group: groupClause });
			//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
			
			aggCol.aggregate(aggQuery, function(e, docs){
				var aggresult = {};
				if (docs && docs[0])
					aggresult = docs[0];
				//res.log(thisFuncName + 'aggresult=' + JSON.stringify(aggresult));

				// Unspool single row of aggregate results into tabular form
				var aggTable = [];
				for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
					var thisLayout = scorelayout[scoreIdx];
					if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
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
				//res.log(thisFuncName + 'aggTable=' + JSON.stringify(aggTable));
				
				// read in the current agg ranges
				currentAggCol.find({}, {}, function (e, docs) {
					var currentAggRanges = [];
					if (docs)
						currentAggRanges = docs;

					res.render("./reports/metrics", {
						title: "Metrics For All Teams",
						currentAggRanges: currentAggRanges,
						aggdata: aggTable
					});
				});
			});
		});
	});	
});

router.get("/metricintel*", function(req, res){
	var thisFuncName = "reports.metric*[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var metricKey = req.query.key;
	if (!metricKey) {
		res.redirect("/?alert=No metric key specified in Metric Intel page.");
		return;
	}
	res.log(thisFuncName + 'metricKey=' + metricKey);
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var currentCol = db.get("current");
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			res.render('/adminindex', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// for later querying by event_key
		var event_key = eventId;
		res.log(thisFuncName + 'event_key=' + event_key);
	
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
		aggQuery.push({ $match : { "data":{$exists:true}, "event_key": event_key } });
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
		//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
		
		aggCol.aggregate(aggQuery, function(e, docs){
			aggdata = docs;

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
			
			//res.log(thisFuncName + 'aggdata=' + JSON.stringify(aggdata));
			
			// read in the current agg ranges
			currentAggCol.find({}, {}, function (e, docs) {
				var currentAggRanges = [];
				if (docs)
					currentAggRanges = docs;

				res.render("./reports/metricintel", {
					title: "Intel: " + metricKey,
					aggdata: aggdata,
					currentAggRanges: currentAggRanges,
					key: metricKey
				});
			});
		});
	});	
});

/**
 * Metrics view
 */
router.get("/allteammetrics", function(req, res){
	var thisFuncName = "reports.allteammetrics[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var scoreCol = db.get("scoringlayout");
	var rankCol = db.get('currentrankings');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	// for later querying by event_key
	var event_key = req.event.key;
	var event_year = req.event.year;
	res.log(thisFuncName + 'event_key=' + event_key);
	
	// get the current rankings
	rankCol.find({}, {}, function (e, docs) {
		var rankings = [];
		if (docs)
			rankings = docs;
		var rankMap = {};
		for (var rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
			//res.log(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
			rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
		}
		//res.log(thisFuncName + 'rankMap=' + JSON.stringify(rankMap));

		// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
		// db.scoringdata.aggregate( [ 
		// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
		// { $group : { _id: "$event_key",
		// "autoScaleAVG": {$avg: "$data.autoScale"},
		// "teleScaleAVG": {$avg: "$data.teleScale"},
		//  } }
		// ] );						
		scoreCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
			var scorelayout = docs;
			
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
					groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
					groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
				}
			}
			aggQuery.push({ $group: groupClause });
			aggQuery.push({ $sort: { _id: 1 } });
			//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
			
			aggCol.aggregate(aggQuery, function(e, docs){
				var aggArray = [];
				if (docs)
					aggArray = docs;
					
				res.log(rankMap);
				
				// Rewrite data into display-friendly values
				for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
					var thisAgg = aggArray[aggIdx];
					for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
						var thisLayout = scorelayout[scoreIdx];
						if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
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
				res.log(thisFuncName + 'aggArray=' + JSON.stringify(aggArray));

				// read in the current agg ranges
				currentAggCol.find({}, {}, function (e, docs) {
					var currentAggRanges = [];
					if (docs)
						currentAggRanges = docs;

					res.render("./reports/allteammetrics", {
						title: "Alliance Selection",
						aggdata: aggArray,
						currentAggRanges: currentAggRanges,
						layout: scorelayout
					});
				});
			});
		});
	});
});

module.exports = router;