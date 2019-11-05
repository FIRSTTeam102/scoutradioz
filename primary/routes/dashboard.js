var express = require('express');
const utilities = require('../utilities');
var router = express.Router();

/**
 * Scouter's dashboard page. Provides a scouter's assigned teams for scouting and assigned matches for scoring
 * @url /dashboard
 * @view dashboard/dashboard-index
 */
router.get('/', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var thisFuncName = "dashboard.{root}[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	
	// var scoutDataCol = db.get("scoutingdata");
	// var pairsDataCol = db.get("scoutingpairs");
	// var scoreDataCol = db.get("scoringdata");
	// var matchCol = db.get("matches");
	
	// for later querying by event_key
	var eventId = req.event.key;

	// Check to see if the logged in user is one of the scouting/scoring assignees
	var assignedTeams = await utilities.find("scoutingdata", {
		"event_key": eventId, 
		"primary": thisUserName
	}, {
		sort: { "team_key": 1 }
	});
		
	// if no assignments, send off to unassigned
	if (assignedTeams.length == 0) {
		res.log(thisFuncName + "User '" + thisUserName + "' has no assigned teams");
		res.redirect('./dashboard/unassigned');
		return;
	}
	for (var assignedIdx = 0; assignedIdx < assignedTeams.length; assignedIdx++)
		res.log(thisFuncName + "assignedTeam[" + assignedIdx + "]=" + assignedTeams[assignedIdx].team_key + "; data=" + assignedTeams[assignedIdx].data);

	// Get their scouting team
	var pairsData = await utilities.find("scoutingpairs", {
		$or:
			[{"member1": thisUserName},
			{"member2": thisUserName},
			{"member3": thisUserName}]
	}, {});

	// we assume they're in a pair!
	var thisPair = pairsData[0];
	
	//Sets up pair label
	var thisPairLabel = thisPair.member1;
	if (thisPair.member2)
		thisPairLabel = thisPairLabel + ", " + thisPair.member2;
	if (thisPair.member3)
		thisPairLabel = thisPairLabel + ", " + thisPair.member3;
			
	//Get teams where they're backup (if any) from scout data collection
	var backupTeams = await utilities.find("scoutingdata", {
		"event_key": eventId,
		$or:
			[{"secondary": thisUserName},
			{"tertiary": thisUserName}]
	}, {
		sort: {"team_key": 1} 
	});
		
	//logs backup teams to console
	for (var backupIdx = 0; backupIdx < backupTeams.length; backupIdx++)
		res.log(thisFuncName + "backupTeam[" + backupIdx + "]=" + backupTeams[backupIdx].team_key);

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matchDocs = await utilities.find("matches", {
		event_key: eventId, 
		"alliances.red.score": -1
	},{
		sort: {"time": 1}
	});
		
	var earliestTimestamp = 9999999999;
	if (matchDocs && matchDocs[0]){
		var earliestMatch = matchDocs[0];
		earliestTimestamp = earliestMatch.time;
	}

	// 2018-04-05, M.O'C - Adding 'predicted time' to a map for later enriching of 'scoreData' results
	var matchLookup = {};
	if (matchDocs)
		for (var matchIdx = 0; matchIdx < matchDocs.length; matchIdx++) {
			//res.log(thisFuncName + 'associating ' + matches[matchIdx].predicted_time + ' with ' + matches[matchIdx].key);
			matchLookup[matchDocs[matchIdx].key] = matchDocs[matchIdx];
		}
		
	// Get all the UNRESOLVED matches where they're set to score
	var scoringMatches = await utilities.find("scoringdata", {"event_key": eventId, "assigned_scorer": thisUserName, "time": { $gte: earliestTimestamp }}, { limit: 10, sort: {"time": 1} });

	for (var matchesIdx = 0; matchesIdx < scoringMatches.length; matchesIdx++)
		res.log(thisFuncName + "scoringMatch[" + matchesIdx + "]: num,team=" + scoringMatches[matchesIdx].match_number + "," + scoringMatches[matchesIdx].team_key);

	for (var scoreIdx = 0; scoreIdx < scoringMatches.length; scoreIdx++) {
		//res.log(thisFuncName + 'getting for ' + scoreData[scoreIdx].match_key);
		scoringMatches[scoreIdx].predicted_time = matchLookup[scoringMatches[scoreIdx].match_key].predicted_time;
	}
	
	res.render('./dashboard/dashboard-index',{
		title: "Dashboard for "+thisUserName,
		"thisPair": thisPairLabel,
		"assignedTeams": assignedTeams,
		"backupTeams": backupTeams,
		"scoringMatches": scoringMatches
	});
});

/**
 * Page for unassigned scorers. Provides links to one-off score matches or scout teams.
 * @url /dashboard/unassigned
 * @view dashboard/unassigned
 */
router.get('/unassigned', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var thisFuncName = "dashboard.unassigned[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	res.render('./dashboard/unassigned',{
		title: 'Unassigned'
	});	
});

/**
 * Alliance selection page
 * @url /dashboard/allianceselection
 * @view dashboard/allianceselection
 */
router.get('/allianceselection', async function(req, res){
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var event_key = req.event.key;
	var event_year = req.event.year;
	
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// var currentAggCol = db.get("currentaggranges");
	// var rankCol = db.get("currentrankings");
	// var scoreDataCol = db.get('scoringdata');
	// var scoreLayoutCol = db.get('scoringlayout');

	var rankings = await utilities.find("currentrankings", {}, {});
	if(!rankings[0])
		return console.error(e || "Couldn't find rankings in allianceselection".red);
	
	var alliances = [];
	for(var i = 0; i < 8; i++){
		alliances[i] = {
			team1: rankings[i].team_key,
			team2: undefined,
			team3: undefined
		}
	}
		
	var rankMap = {};
	for (var rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
		//res.log(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
	}

	var scoreLayout = await utilities.find("scoringlayout", { year: event_year }, {sort: {"order": 1}});
	if(!scoreLayout[0])
		return console.error(e || "Couldn't find scoringlayout in allianceselection".red);
	
	//initialize aggQuery
	var aggQuery = [];
	//add $match > event_key
	aggQuery.push({ $match : { "event_key": event_key } });
	//initialize groupClause
	var groupClause = {};
	//group teams for 1 row per team
	groupClause["_id"] = "$team_key";
	
	//iterate through scoringlayout
	for (var scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
		//pull this layout element from score layout
		var thisLayout = scoreLayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scoreLayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
			groupClause[thisLayout.id] = {$avg: "$data." + thisLayout.id};
	}
	//add $group > groupClause (Layout w/ data)
	aggQuery.push({ $group: groupClause });
	//add $sort > sort request
	aggQuery.push({ $sort: { rank: 1 } });
	
	//Aggregate with this query we made
	var aggArray = await utilities.aggregate("scoringdata", aggQuery);
	if(!aggArray[0])
		return console.error(e || "Couldn't find scoringdata in allianceselection".red)
	
	// Rewrite data into display-friendly values
	for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
		//get thisAgg
		var thisAgg = aggArray[aggIdx];
		for (var scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
			var thisLayout = scoreLayout[scoreIdx];
			if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
				var roundedVal = (Math.round(thisAgg[thisLayout.id] * 10)/10).toFixed(1);
				thisAgg[thisLayout.id] = roundedVal;
			}
		}
		if(!rankMap[thisAgg._id] || !rankMap[thisAgg._id].value){
			//return res.redirect("/?alert=Make sure that team rankings have been pulled from TheBlueAlliance");
			res.log(`Gonna crash w/ id ${thisAgg._id}`);
		}
		if(rankMap[thisAgg._id]){
			thisAgg['rank'] = rankMap[thisAgg._id].rank;
			thisAgg['value'] = rankMap[thisAgg._id].value;
			aggArray[aggIdx] = thisAgg;
		}
	}
	//quick sort by rank
	aggArray.sort(function(a,b){
		let aNum = a.rank;
		let bNum = b.rank;
		if( aNum < bNum ){
			return -1;
		}
		if( aNum > bNum ){
			return 1;
		}
	});
	
	var sortedTeams = [];
	for(var i = 8; i < rankings.length; i++){
		sortedTeams[i - 8] = {
			rank: rankings[i].rank,
			team_key: rankings[i].team_key
		};
	}
	sortedTeams.sort(function(a,b){
		if(a && b){
			let aNum = parseInt(a.team_key.substring(3));
			let bNum = parseInt(b.team_key.substring(3));
			if( aNum < bNum ){
				return -1;
			}
			if( aNum > bNum ){
				return 1;
			}
		}else{
			return 1;
		}
	});
	
	console.log(sortedTeams);

	// read in the current agg ranges
	var currentAggRanges = await utilities.find("currentaggranges", {}, {});

	//res.log(thisFuncName + 'aggArray=' + JSON.stringify(aggArray));
	res.render('./dashboard/allianceselection', {
		title: "Alliance Selection",
		rankings: rankings,
		alliances: alliances,
		aggdata: aggArray,
		currentAggRanges: currentAggRanges,
		layout: scoreLayout,
		sortedTeams: sortedTeams
	});
});

router.get('/pits', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var thisFuncName = "dashboard.pits[get]: ";
	res.log(thisFuncName + 'ENTER');

	// var scoutDataCol = db.get("scoutingdata");
	// var currentTeamsCol = db.get('currentteams');
	
	// are we asking for pictures?
	var pics = req.query.pics;

	// for later querying by event_key
	var event_key = req.event.key;

	var teams = await utilities.find("scoutingdata", {"event_key": event_key}, { });
		
	//sort teams list by number
	teams.sort(function(a, b) {
		let aNum = parseInt(a.team_key.substring(3));
		let bNum = parseInt(b.team_key.substring(3));
		if( aNum < bNum ){
			return -1;
		}
		if( aNum > bNum ){
			return 1;
		}
		return 0;
	});
	
	// read in team list for data
	var teamArray = await utilities.find("currentteams", {},{ sort: {team_number: 1} });
		
	// Build map of team_key -> team data
	var teamKeyMap = {};
	for (var teamIdx = 0; teamIdx < teamArray.length; teamIdx++)
	{
		//res.log(thisFuncName + 'teamIdx=' + teamIdx + ', teamArray[]=' + JSON.stringify(teamArray[teamIdx]));
		teamKeyMap[teamArray[teamIdx].key] = teamArray[teamIdx];
	}

	// Add data to 'teams' data
	for (var teamIdx = 0; teamIdx < teams.length; teamIdx++)
	{
		//res.log(thisFuncName + 'teams[teamIdx]=' + JSON.stringify(teams[teamIdx]) + ', teamKeyMap[teams[teamIdx].team_key]=' + JSON.stringify(teamKeyMap[teams[teamIdx].team_key]));
		teams[teamIdx].nickname = teamKeyMap[teams[teamIdx].team_key].nickname;
	}
	//Add a call to the database for populating menus in pit scouting
	
	res.render('./dashboard/pits', {
		title: "Pit Scouting", 
		pics: pics,
		"teams": teams
	});	
});

router.get('/matches', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var thisFuncName = "dashboard.matches[get]: ";
	res.log(thisFuncName + 'ENTER');

	// var scoreDataCol = db.get("scoringdata");
	// var matchCol = db.get("matches");
	// //var teamsCol = db.get("teams");
	// var currentTeamsCol = db.get('currentteams');

	// for later querying by event_key
	var eventId = req.event.key;

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matches = await utilities.find("matches", { event_key: eventId, "alliances.red.score": -1 },{sort: {"time": 1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (matches && matches[0])
	{
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	// 2018-04-05, M.O'C - Adding 'predicted time' to a map for later enriching of 'scoreData' results
	var matchLookup = {};
	if (matches)
		for (var matchIdx = 0; matchIdx < matches.length; matchIdx++) {
			//res.log(thisFuncName + 'associating ' + matches[matchIdx].predicted_time + ' with ' + matches[matchIdx].key);
			matchLookup[matches[matchIdx].key] = matches[matchIdx];
		}

	res.log(thisFuncName + 'earliestTimestamp=' + earliestTimestamp);

	// Get all the UNRESOLVED matches
	var scoreData = await utilities.find("scoringdata", {"event_key": eventId, "time": { $gte: earliestTimestamp }}, { limit: 60, sort: {"time": 1, "alliance": 1, "team_key": 1} });

	if(!scoreData)
		return console.error("mongo error at dashboard/matches");

	res.log(thisFuncName + 'scoreData.length=' + scoreData.length);

	for (var scoreIdx = 0; scoreIdx < scoreData.length; scoreIdx++) {
		//res.log(thisFuncName + 'getting for ' + scoreData[scoreIdx].match_key);
		scoreData[scoreIdx].predicted_time = matchLookup[scoreData[scoreIdx].match_key].predicted_time;
	}
	
	res.log(thisFuncName + 'DEBUG getting nicknames next?');

	// read in team list for data
	var teamArray = await utilities.find("currentteams", {},{ sort: {team_number: 1} });
	//teamsCol.find({},{ sort: {team_number: 1} }, function(e, docs) {
		
	// Build map of team_key -> team data
	var teamKeyMap = {};
	for (var teamIdx = 0; teamIdx < teamArray.length; teamIdx++)
	{
		//res.log(thisFuncName + 'teamIdx=' + teamIdx + ', teamArray[]=' + JSON.stringify(teamArray[teamIdx]));
		teamKeyMap[teamArray[teamIdx].key] = teamArray[teamIdx];
	}

	for(var i in scoreData)
	{
		scoreData[i].team_nickname = "None";
		if (teamKeyMap[scoreData[i].team_key])
			scoreData[i].team_nickname = teamKeyMap[scoreData[i].team_key].nickname;
	}
		//this line has a definition problem ^
	console.log(thisFuncName + 'scoreData.length=' + scoreData.length);
	res.render('./dashboard/matches',{
		title: "Match Scouting",
		matches: scoreData
	});
});

module.exports = router;
