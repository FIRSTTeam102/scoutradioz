var express = require('express');
var router = express.Router();
var utilities = require('../../utilities');

/**
 * Admin page to manually input/edit list of teams at an event (w/o TBA).
 * @url /admin/manualinput/teams
 * @views manualinput/teams
 */
router.get('/teams', async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	//Get list of currentteams
	var teamsArray = await utilities.find("currentteams", {}, {sort: {"team_number": 1}});
	
	res.render('./manualinput/teams', {
		title: "Edit List of Teams",
		teams: teamsArray
	});
});

/**
 * POST method to retrieve manually updated list of teams.
 * @url /admin/manualinput/teams
 * @redirect /admin
 */
router.post('/teams', async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	res.log(req.body);
	
	var teamNumbersArray = [];
	var teamInfoArray = [];
	var tbaPromiseArray = [];
	
	for(var teamNumberInputName in req.body){
		//grab team number
		var teamNumberInput = req.body[teamNumberInputName];
		var teamNumber = parseInt(teamNumberInput);
		
		//if number is valid, proceed
		if(!isNaN(teamNumber)){
			teamNumbersArray.push(teamNumber);
		}
	}
	
	var startTime = Date.now();
	
	//Fill an array of Promises for TBA info on each team.
	for(var i = 0; i < teamNumbersArray.length; i++){
		//request info from TBA
		tbaPromiseArray[i] =  utilities.requestTheBlueAlliance(`team/frc${teamNumbersArray[i]}`);
	}
	
	//Await all TBA Promises.
	for(var i = 0; i < tbaPromiseArray.length; i++){
		//await all requests
		teamInfoArray[i] = await tbaPromiseArray[i];
	}
	
	res.log(`Done with TBA call in ${Date.now() - startTime} ms`);
	
	//Go through teamInfoArray and splice out any item that contains errors
	for(var i = 0; i < teamInfoArray.length; i++){
		var thisTeamInfo = teamInfoArray[i];
		//if obj contains error, remove it
		if(thisTeamInfo.Errors){
			res.log("Going to remove: " + JSON.stringify(thisTeamInfo));
			teamInfoArray.splice(i, 1);
			i--;
		}
	}
	
	var teamInfoNoDuplicates = [];
	
	//Rebuild array without duplicates.
	for(var i = 0; i < teamInfoArray.length; i++){
		
		//grab team info to check for dupes
		var thisTeamInfo = teamInfoArray[i];
		var thisTeamNum = thisTeamInfo.team_number;
		
		let didFindDuplicate = false;
		
		res.log("================");
		res.log("CHECKING TEAM " + thisTeamNum);
		
		for(var j = 0; j < teamInfoNoDuplicates.length; j++){
			
			//grab team info to compare
			var thatTeamInfo = teamInfoArray[j];
			var thatTeamNum = thatTeamInfo.team_number;
			
			res.log("CMP: " + thatTeamNum);
			
			//if duplicat exists, set true
			if(thisTeamNum == thatTeamNum){
				didFindDuplicate = true;
				res.log("MATCH: Removing duplicate " + thisTeamNum + " from team list", true);
			}
		}
		//Add to new array if no duplicates exist.
		if(!didFindDuplicate){
			teamInfoNoDuplicates.push(thisTeamInfo);
			res.log("PUSHING " + thisTeamNum);
		}
	}
	
	//Now, we have a list of all teams attending the event.
	//Empty currentteams.
	await utilities.remove("currentteams");
	
	//Now, insert into currentteams.
	await utilities.insert("currentteams", teamInfoNoDuplicates);
	
	//Redirect with success message.
	res.redirect('/admin?alert=Input teams successfully.');
});

/**
 * POST Method that fetches info on a team from TheBlueAlliance.
 * @param team_number Team number to fetch
 * @return [Object] Team info from TBA. If the team is invalid, object contains only an array named "Errors".
 */
router.post('/api/team', async function(req, res){
	
	if(!req.body.team_number){
		res.log("admin/manualinput/api/team error: No team number specified.", true);
		return res.status(400).send("No team number specified.");
	}
	
	//get team number
	var team_number = parseInt(req.body.team_number);
	
	//if not a number, return with error 400
	if(isNaN(team_number)){
		res.log("admin/manualinput/api/team error: No team number specified.", true);
		return res.status(400).send("Team number was not parseable.");
	}
	
	//create team key
	var team_key = "frc" + team_number;
	
	var teamInfoResponse = await utilities.requestTheBlueAlliance(`team/${team_key}`);
	
	res.status(200).send(teamInfoResponse);
	
	res.log(teamInfoResponse);
});

/**
 * Manual input for inputtnig match schedule, if TBA is not accessible.
 * @url /manualinput/matchschedule
 * @views manualinput/matchschedule
 */
router.get('/matchschedule', async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "[GET] /admin/manualinput/matchschedule => ";
	
	var event_key = req.event.key;
	
	res.log(`${thisFuncName} Getting matches`);
	
	var matches = await utilities.find("matches", {"event_key": event_key});
	
	res.render('./manualinput/matchschedule', {
		title: "Enter Match Schedule",
		matches: matches
	});
});

router.post('/matchschedule', async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	/*
		"actual_time": "",
		"alliances": {
			"blue": {
				"score": -1,
				"team_keys": [
					"frc5684",
					"frc4454",
					"frc5401"
				]
			},
			"red": {
				"score": -1,
				"team_keys": [
					"frc1807",
					"frc2539",
					"frc2559"
				]
			}
		},
		"comp_level": "f",
		"event_key": "2019pahat",
		"key": "2019pahat_f1m1",
		"match_number": 1,
		"post_result_time": 1551646484,
		"predicted_time": 1551646323,
		"set_number": 1,
		"time": 1551644760,
		"winning_alliance": ""
	*/
	
	var event_key = req.event.key;
	
	//Cycle through body and assemble an array of matches.
	//Array of matches
	var matchArray = [];
	//Current match row (*_1, *_2, *_3 etc; the number is idx + 1)
	var idx = 0;
	
	for(var elementName in req.body){
		//if this input elem. name is a match row (Names are split by Name_#)
		if(elementName.split("_")[1]){
			//update idx to the # in element name minus 1
			idx = parseInt(elementName.split("_")[1]) - 1;
			//if no match obj has been created in matchArray, create one
			if(!matchArray[idx]){
				matchArray[idx] = {};
			}
			//grab this match obj
			var thisMatch = matchArray[idx];
			//add this element to match obj
			var nameMinusNumber = elementName.split("_")[0]
			thisMatch[nameMinusNumber] = req.body[elementName];
		}
	}
	
	res.log(matchArray);
	
	//We now have an array, comprised of every user match input, separated by each match.
	//We need to rearrange the data to fit our database needs.
	
	//First, filter matchArray to trash any matches that don't have complete data.
	var matchArrayFiltered = [];
	
	for(var i = 0; i < matchArray.length; i++){
		var match = matchArray[i];
		
		if(match.BlueTeam1 && match.BlueTeam2 && match.BlueTeam3 &&
			match.RedTeam1 && match.RedTeam2 && match.RedTeam3 && match.SchedTime != -1){
				//If all elements exist and are populated, and time is not -1
				matchArrayFiltered.push(match);
		}
	}
	
	res.log(matchArrayFiltered);
	
	//Now, we can rearrange our data.
	var matchArrayFormatted = [];
	
	for(var i = 0; i < matchArrayFiltered.length; i++){
		
		var match = matchArrayFiltered[i];
		//Time is in seconds, not ms: divide by 1000
		match.SchedTime = parseInt( match.SchedTime / 1000 );
		//Create formatted match thing
		matchArrayFormatted[i] = {
			"actual_time": "",
			"alliances": {
				"blue": {
					"score": -1,
					"team_keys": [
						"frc" + match.BlueTeam1,
						"frc" + match.BlueTeam2,
						"frc" + match.BlueTeam3
					]
				},
				"red": {
					"score": -1,
					"team_keys": [
						"frc" + match.RedTeam1,
						"frc" + match.RedTeam2,
						"frc" + match.RedTeam3
					]
				}
			},
			"comp_level": "qm", //only support qualifying matches
			"event_key": event_key,
			"key": `${event_key}_qm${i + 1}`, //2019pahat_qm1 (# is i+1) 
			"match_number": i + 1,
			"post_result_time": match.SchedTime, //idk what all this time stuff is, just gonna set it to sched time
			"predicted_time": match.SchedTime,
			"set_number": 1,
			"time": match.SchedTime,
			"winning_alliance": ""
		}
	}
	
	res.log(matchArrayFormatted);
	
	//Remove matches from db
	await utilities.remove("matches", {"event_key": event_key});
	
	//now insert matches into db
	await utilities.insert("matches", matchArrayFormatted);
	
	res.redirect('./matchschedule');
})

/**
 * Manual input for correcting each match, if TBA is not accessible.
 * @url /manualinput/matches
 * @views manualinput/matches
 */
router.get('/matches', async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var event_key = req.event.key;
	
	var matches = await utilities.find("matches", {"event_key": event_key}, {sort: {time: 1}});
	
	res.render("./manualinput/matches", {
		title: "Input Match Outcomes",
		matches: matches,
	});
});

/** POST method for 
 * 
 */
router.post('/matches', async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;	
	
	var event_key = req.event.key;
	
	//Get list of matches from the database.
	var matches = await utilities.find("matches", {"event_key": event_key}, {sort: {time: 1}});
	
	var startTime = Date.now();
	
	//Build array of each match, from user input
	var userInputGrouped = {};
	
	//go through body and group every piece of data
	for(var elementName in req.body){
		//console.log(`${elementName}: ${req.body[elementName]}`);
		var elementContents = req.body[elementName];
		
		//match key 2019mrcmp_qm1
		var thisMatchKey = elementName.split("_")[1] + "_" + elementName.split("_")[2];
		//e.g. BlueCompletedRocket or WinningAlliance
		var thisElementType = elementName.split("_")[0];
		
		//if a match does not exist already, create new obj
		if( !userInputGrouped[thisMatchKey] ){
			userInputGrouped[thisMatchKey] = {};
		}
		//add contents to grouped match info
		userInputGrouped[thisMatchKey][thisElementType] = elementContents;
	}
	
	for(var i in matches){
		var match = matches[i];
		var match_key = match.key;
		
		var userInputThisMatch = userInputGrouped[match_key];
		
		//Modify winning alliance
		match.winning_alliance = userInputThisMatch.WinningAlliance;
		
		//If score_brakdown has not yet been created, create it now.
		if(!match.score_breakdown){
			match.score_breakdown = {
				blue: {},
				red: {}
			};
		}
		
		//Modify blue score
		match.alliances.blue.score = ( isNaN(parseInt(userInputThisMatch.BlueScore)) || userInputThisMatch.BlueScore == 0) ? -1 : parseInt(userInputThisMatch.BlueScore);
		match.score_breakdown.blue.totalPoints = ( isNaN(parseInt(userInputThisMatch.BlueScore)) || userInputThisMatch.BlueScore == 0) ? -1 : parseInt(userInputThisMatch.BlueScore);
		//Modify red score
		match.alliances.red.score = ( isNaN(parseInt(userInputThisMatch.RedScore)) || userInputThisMatch.RedScore == 0) ? -1 : parseInt(userInputThisMatch.RedScore);
		match.score_breakdown.red.totalPoints = ( isNaN(parseInt(userInputThisMatch.RedScore)) || userInputThisMatch.RedScore == 0) ? -1 : parseInt(userInputThisMatch.RedScore);
		//Modify blue RPs
		match.score_breakdown.blue.habDockingRankingPoint = ( userInputThisMatch.BlueHabDock == 'on' ) ? true : false;
		match.score_breakdown.blue.completeRocketRankingPoint = ( userInputThisMatch.BlueCompletedRocket == 'on' ) ? true : false;
		//Modify red RPs
		match.score_breakdown.red.habDockingRankingPoint = ( userInputThisMatch.RedHabDock == 'on' ) ? true : false;
		match.score_breakdown.red.completeRocketRankingPoint = ( userInputThisMatch.RedCompletedRocket == 'on' ) ? true : false;
	}
	
	
	//Remove matches
	await utilities.remove("matches", {"event_key": event_key});
	
	//Now, insert updated list of matches
	await utilities.insert("matches", matches);
	
	var endTime = Date.now();
	res.log(`Done in ${endTime - startTime} ms`);
	
	//// Recalculate rankings
	/*
		"dq" : 0,
		"extra_stats" : [ 24 ],   // RP
		"matches_played" : 10,
		"qual_average" : null,
		"rank" : 1,
		"record" : {
			"losses" : 1,
			"ties" : 1,
			"wins" : 8 },
		"sort_orders" : [ 2.4, 261, 100, 141, 141, 0 ],
		"team_key" : "frc1708"
	*/

	// Build an array of objects, one per team
	var teamsArray = await utilities.find("currentteams", {}, {sort: {"team_number": 1}});
	mapTeamToOrder = {};
	rankArray = [];
	for (var i in teamsArray) {
		var team = teamsArray[i];
		thisRank = {
			"dq": 0,
			"extra_stats": [0],
			"qual_average": null,
			"record": {
				"losses": 0,
				"ties": 0,
				"wins": 0 },
			"sort_orders": [0, 0, 0],
			"team_key": team.key,
			"team_number": team.team_number };
		rankArray.push(thisRank);
		mapTeamToOrder[team.key] = i;
	}
	console.log("DEBUG: rankArray=" + JSON.stringify(rankArray));
	console.log("DEBUG: mapTeamToOrder=" + JSON.stringify(mapTeamToOrder));
	console.log("DEBUG: frc102=" + JSON.stringify(mapTeamToOrder["frc102"]));

	// Go through every match, updating the rank array
	for (var i in matches) {
		var thisMatch = matches[i];

		if (thisMatch.alliances.red.score != -1) {
			//console.log("DEBUG: match=" + JSON.stringify(thisMatch));
			/*
			match={
				"alliances":{
					"blue":{
						"score":41,
						"team_keys":["frc677","frc5740","frc7670"]},
					"red":{
						"score":52,
						"team_keys":["frc102","frc117","frc48"]}},
				"match_number":56,
				"score_breakdown":{
					"blue":{
						"totalPoints":41,
						"habDockingRankingPoint":false,
						"completeRocketRankingPoint":false},
					]"red":{
						"totalPoints":52,
						"habDockingRankingPoint":true,
						"completeRocketRankingPoint":false}},
				"set_number":1,
				"winning_alliance":"red"}
			*/
			// alliances
			var redRP = 0;
			var blueRP = 0;
			var redWin = 0; var blueWin = 0; var isTie = 0;
			if (thisMatch.winning_alliance == "red") { redRP = 2; redWin = 1; }
			if (thisMatch.winning_alliance == "blue") { blueRP = 2; blueWin = 1; }
			if (thisMatch.winning_alliance == "") { redRP = 1; blueRP = 1; isTie = 1; }
			if (thisMatch.score_breakdown.red.habDockingRankingPoint) redRP++;
			if (thisMatch.score_breakdown.red.completeRocketRankingPoint) redRP++;
			if (thisMatch.score_breakdown.blue.habDockingRankingPoint) blueRP++;
			if (thisMatch.score_breakdown.blue.completeRocketRankingPoint) blueRP++;
			var redScore = thisMatch.alliances.red.score;
			var blueScore = thisMatch.alliances.blue.score;

			// red
			for (var j in thisMatch.alliances.red.team_keys) {
				var thisTeamKey = thisMatch.alliances.red.team_keys[j];
				var thisRankIndex = mapTeamToOrder[thisTeamKey];
				if (rankArray[thisRankIndex]) {
					var currentRP = 0; if (rankArray[thisRankIndex].RP) currentRP = rankArray[thisRankIndex].RP;
					var currentMatchesPlayed = 0; if (rankArray[thisRankIndex].matches_played) currentMatchesPlayed = rankArray[thisRankIndex].matches_played;
					var currentWins = 0; var currentLosses = 0; var currentTies = 0;
					if (rankArray[thisRankIndex].record) {
						if (rankArray[thisRankIndex].record.wins) currentWins = rankArray[thisRankIndex].record.wins;
						if (rankArray[thisRankIndex].record.losses) currentLosses = rankArray[thisRankIndex].record.losses;
						if (rankArray[thisRankIndex].record.ties) currentTies = rankArray[thisRankIndex].record.ties;
					}
					var currentPointsFor = 0; if (rankArray[thisRankIndex].pointsFor) currentPointsFor = rankArray[thisRankIndex].pointsFor;
					var currentPointsAgainst = 0; if (rankArray[thisRankIndex].pointsAgainst) currentPointsAgainst = rankArray[thisRankIndex].pointsAgainst;

					currentRP += redRP; var thisRankValueArray = []; thisRankValueArray.push(currentRP);
					currentMatchesPlayed++;
					currentWins += redWin;
					currentLosses += blueWin;
					currentTies += isTie;
					currentPointsFor += redScore;
					currentPointsAgainst += blueScore;
					var thisSortOrders = [];
					thisSortOrders.push(currentRP/currentMatchesPlayed);
					thisSortOrders.push(currentPointsFor);
					thisSortOrders.push(currentPointsAgainst);

					rankArray[thisRankIndex].matches_played = currentMatchesPlayed;
					rankArray[thisRankIndex].extra_stats = thisRankValueArray;
					rankArray[thisRankIndex].record = {};
					rankArray[thisRankIndex].record.wins = currentWins;
					rankArray[thisRankIndex].record.losses = currentLosses;
					rankArray[thisRankIndex].record.ties = currentTies;
					rankArray[thisRankIndex].sort_orders = thisSortOrders;

					rankArray[thisRankIndex].RP = currentRP;
					rankArray[thisRankIndex].pointsFor = currentPointsFor;
					rankArray[thisRankIndex].pointsAgainst = currentPointsAgainst;
				}
			}

			// blue
			for (var j in thisMatch.alliances.blue.team_keys) {
				var thisTeamKey = thisMatch.alliances.blue.team_keys[j];
				var thisRankIndex = mapTeamToOrder[thisTeamKey];
				if (rankArray[thisRankIndex]) {
					var currentRP = 0; if (rankArray[thisRankIndex].RP) currentRP = rankArray[thisRankIndex].RP;
					var currentMatchesPlayed = 0; if (rankArray[thisRankIndex].matches_played) currentMatchesPlayed = rankArray[thisRankIndex].matches_played;
					var currentWins = 0; var currentLosses = 0; var currentTies = 0;
					if (rankArray[thisRankIndex].record) {
						if (rankArray[thisRankIndex].record.wins) currentWins = rankArray[thisRankIndex].record.wins;
						if (rankArray[thisRankIndex].record.losses) currentLosses = rankArray[thisRankIndex].record.losses;
						if (rankArray[thisRankIndex].record.ties) currentTies = rankArray[thisRankIndex].record.ties;
					}
					var currentPointsFor = 0; if (rankArray[thisRankIndex].pointsFor) currentPointsFor = rankArray[thisRankIndex].pointsFor;
					var currentPointsAgainst = 0; if (rankArray[thisRankIndex].pointsAgainst) currentPointsAgainst = rankArray[thisRankIndex].pointsAgainst;

					currentRP += blueRP; var thisRankValueArray = []; thisRankValueArray.push(currentRP);
					currentMatchesPlayed++;
					currentWins += blueWin;
					currentLosses += redWin;
					currentTies += isTie;
					currentPointsFor += blueScore;
					currentPointsAgainst += redScore;
					var thisSortOrders = [];
					var rpRatio = currentRP/currentMatchesPlayed;
					thisSortOrders.push(rpRatio);
					thisSortOrders.push(currentPointsFor);
					thisSortOrders.push(currentPointsAgainst);

					rankArray[thisRankIndex].matches_played = currentMatchesPlayed;
					rankArray[thisRankIndex].extra_stats = thisRankValueArray;
					rankArray[thisRankIndex].record = {};
					rankArray[thisRankIndex].record.wins = currentWins;
					rankArray[thisRankIndex].record.losses = currentLosses;
					rankArray[thisRankIndex].record.ties = currentTies;
					rankArray[thisRankIndex].sort_orders = thisSortOrders;

					rankArray[thisRankIndex].RP = currentRP;
					//rankArray[thisRankIndex].rpPerMatch = rpRatio;
					rankArray[thisRankIndex].pointsFor = currentPointsFor;
					rankArray[thisRankIndex].pointsAgainst = currentPointsAgainst;
				}
			}
		}
	}
	console.log("DEBUG: rankArray=" + JSON.stringify(rankArray));

	// comparator for rankings - generally, higher numbers means 'lower' rank #
	var compareRankings = function(a,b) {
		if (a.sort_orders && b.sort_orders) {
			if (a.sort_orders[0] < b.sort_orders[0]) return 1;
			if (a.sort_orders[0] > b.sort_orders[0]) return -1;
			if (a.sort_orders[1] < b.sort_orders[1]) return 1;
			if (a.sort_orders[1] > b.sort_orders[1]) return -1;
			if (a.sort_orders[2] < b.sort_orders[2]) return 1;
			if (a.sort_orders[2] > b.sort_orders[2]) return -1;
		}
		// final tiebreaker - inverted (lower team #s -> higher rank)
		return a.team_number - b.team_number;		
	}
	// sort the rankings
	var sortedRankArray = rankArray.sort(compareRankings);
	// add in the rank values
	for (var i in sortedRankArray) {
		sortedRankArray[i].rank = parseInt(i) + 1;
	}
	console.log("DEBUG: sortedRankArray=" + JSON.stringify(sortedRankArray));

	//Remove rankings
	await utilities.remove("currentrankings", {});

	//Now, insert updated rankings
	await utilities.insert("currentrankings", sortedRankArray);

	//Redirect to updatematches page with success alert.
	res.redirect('/admin/manualinput/matches?alert=Updated match successfully.');
});

module.exports = router;