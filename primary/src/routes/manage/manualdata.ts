import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e, { assert } from 'scoutradioz-http-errors';
import type { Org, Event, Match, RankingPoints, Ranking } from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('manualdata');

router.all('/*', wrap(async (req, res, next) => {
	//Require GLOBAL-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to manually input/edit list of teams at an event (w/o TBA).
 * @url /manage/manualdata/teams
 * @views manualdata/teams
 */
router.get('/teams', wrap(async (req, res) => {
	
	//Get list of currentteams
	let teamsArray = req.teams;
	
	res.render('./manage/manualdata/teams', {
		title: 'Edit List of Teams',
		teams: teamsArray
	});
}));

/**
 * POST method to retrieve manually updated list of teams.
 * @url /manage/manualdata/teams
 * @redirect /admin
 */
router.post('/teams', wrap(async (req, res) => {
	logger.addContext('funcName', 'manualdata.teams[post]');
	
	// return res.send('Legacy code! Don\'t break the site!');
	
	// /*
	logger.debug(req.body);
	
	
	// return res.send('Legacy code! Don\'t break the site!');
	
	let teamKeysArray: string[] = [];
	const event_key = req.event.key; // don't need to have it part of the form, right?
	
	for(let teamNumberInputName in req.body){
		//grab team number
		let teamNumberInput = req.body[teamNumberInputName];
		let teamNumber = parseInt(teamNumberInput);
		
		//if number is valid and not duplicate, add to array
		let thisTeamKey = 'frc' + teamNumber;
		if(!isNaN(teamNumber) && !teamKeysArray.includes(thisTeamKey)){
			teamKeysArray.push(thisTeamKey);
		}
	}
	
	teamKeysArray.sort(); // tba sends team key list sorted as strings rather than as numbers
	
	let eventData: Event = await utilities.findOne('events', {key: event_key});
	assert(eventData, 'Could not find event!');
	
	logger.info(`Previous list of team_keys for event ${event_key}: ${JSON.stringify(eventData.team_keys)}`);
	logger.info(`New list of team_keys for event ${event_key}: ${JSON.stringify(teamKeysArray)}`);
	
	const writeResult = await utilities.update('events', {key: event_key}, {$set: {team_keys: teamKeysArray}});
	logger.debug(`Updated ${writeResult.modifiedCount} documents`);
	
	return res.redirect('/manage?alert=Updated team list successfully.');
}));

/**
 * POST Method that fetches info on a team from TheBlueAlliance.
 * @param team_number Team number to fetch
 * @return [Object] Team info from TBA. If the team is invalid, object contains only an array named "Errors".
 */
router.post('/api/team', wrap(async (req, res) => {
	
	if(!req.body.team_number){
		logger.debug('manage/manualdata/api/team error: No team number specified.', true);
		return res.status(400).send('No team number specified.');
	}
	
	//get team number
	let team_number = parseInt(req.body.team_number);
	
	//if not a number, return with error 400
	if(isNaN(team_number)){
		logger.debug('manage/manualdata/api/team error: No team number specified.', true);
		return res.status(400).send('Team number was not parseable.');
	}
	
	//create team key
	let team_key = 'frc' + team_number;
	
	let teamInfoResponse = await utilities.requestTheBlueAlliance(`team/${team_key}`);
	
	res.status(200).send(teamInfoResponse);
	
	logger.debug(teamInfoResponse);
}));

/**
 * Manual input for inputtnig match schedule, if TBA is not accessible.
 * @url /manualdata/matchschedule
 * @views manualdata/matchschedule
 */
router.get('/matchschedule', wrap(async (req, res) => {
	logger.addContext('funcName', 'manualdata.matchschedule[GET]');
	
	let event_key = req.event.key;
	
	logger.debug('Getting matches');
	
	let matches = await utilities.find('matches', 
		{event_key, comp_level: 'qm'}, 
		{sort: {match_number: 1}}
	);
	
	let teamNumbers = req.teams ? req.teams.map((team) => team.team_number) : [];
	let event = await utilities.findOne('events', {key: req.event.key}, {}, {allowCache: true});
	
	res.render('./manage/manualdata/matchschedule', {
		title: 'Enter Match Schedule',
		matches,
		teamNumbers,
		event,
	});
}));

router.post('/matchschedule', wrap(async (req, res) => {
	logger.addContext('funcName', 'manualdata.matchschedule[POST]');
	
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
	
	let event_key = req.event.key;
	
	//Cycle through body and assemble an array of matches.
	//Array of matches
	let matchArray: StringDict[] = [];
	//Current match row (*_1, *_2, *_3 etc; the number is idx + 1)
	let idx = 0;
	
	for(let elementName in req.body){
		//if this input elem. name is a match row (Names are split by Name_#)
		if(elementName.split('_')[1]){
			//update idx to the # in element name minus 1
			idx = parseInt(elementName.split('_')[1]) - 1;
			//if no match obj has been created in matchArray, create one
			if(!matchArray[idx]){
				matchArray[idx] = {};
			}
			//grab this match obj
			let thisMatch = matchArray[idx];
			//add this element to match obj
			let nameMinusNumber = elementName.split('_')[0];
			thisMatch[nameMinusNumber] = req.body[elementName];
		}
	}
	
	logger.debug(`matchArray=${JSON.stringify(matchArray)}`);
	
	//We now have an array, comprised of every user match input, separated by each match.
	//We need to rearrange the data to fit our database needs.
	
	//First, filter matchArray to trash any matches that don't have complete data.
	let matchArrayFiltered = [];
	
	for(let i = 0; i < matchArray.length; i++){
		let match = matchArray[i];
		
		if(match.BlueTeam1 && match.BlueTeam2 && match.BlueTeam3 &&
			match.RedTeam1 && match.RedTeam2 && match.RedTeam3 && match.SchedTime != '-1'){
			//If all elements exist and are populated, and time is not -1
			matchArrayFiltered.push(match);
		}
	}
	
	logger.debug(`matchArrayFiltered=${JSON.stringify(matchArrayFiltered)}`);
	
	//Now, we can rearrange our data.
	let matchArrayFormatted: Match[] = [];
	
	for(let i = 0; i < matchArrayFiltered.length; i++){
		
		let match = matchArrayFiltered[i];
		//Time is in seconds, not ms: divide by 1000
		let schedTime = Math.floor( parseInt(match.SchedTime) / 1000 );
		//Create formatted match thing
		matchArrayFormatted[i] = {
			actual_time: '',
			alliances: {
				blue: {
					dq_team_keys: [],
					score: -1,
					surrogate_team_keys: [],
					team_keys: [
						'frc' + match.BlueTeam1,
						'frc' + match.BlueTeam2,
						'frc' + match.BlueTeam3
					],
				},
				red: {
					dq_team_keys: [],
					score: -1,
					surrogate_team_keys: [],
					team_keys: [
						'frc' + match.RedTeam1,
						'frc' + match.RedTeam2,
						'frc' + match.RedTeam3
					]
				}
			},
			comp_level: 'qm', //only support qualifying matches
			event_key: event_key,
			key: `${event_key}_qm${i + 1}`, //2019pahat_qm1 (# is i+1) 
			match_number: i + 1,
			post_result_time: schedTime, //idk what all this time stuff is, just gonna set it to sched time
			predicted_time: schedTime,
			set_number: 1,
			time: schedTime,
			winning_alliance: '',
			score_breakdown: {
				red: {},
				blue: {},
			},
			videos: [],
			manually_entered: true, // 2023-02-20 JL: added manually_entered
		};
	}
	
	// logger.debug(matchArrayFormatted);
	
	//Remove matches from db
	await utilities.remove('matches', {event_key});
	
	//now insert matches into db
	await utilities.insert('matches', matchArrayFormatted);
	
	res.redirect('/manage/manualdata/matchschedule?alert=Updated match schedule successfully.');
}));

/**
 * Manual input for correcting each match, if TBA is not accessible.
 * @url /manualdata/matchresults
 * @views manualdata/matchresults
 */
router.get('/matchresults', wrap(async (req, res) => {
	
	const event_key = req.event.key;
	const year = req.event.year;
	
	let matches = await utilities.find('matches', {event_key}, {sort: {time: 1}});
	let rankingpoints: RankingPoints = await utilities.findOne('rankingpoints', {year});
	assert(rankingpoints, new e.InternalDatabaseError(`Couldn't find ranking point information for the year ${year}`));
	
	res.render('./manage/manualdata/matchresults', {
		title: 'Input Match Outcomes',
		matches,
		rankingpoints
	});
}));

/** POST method for 
 * 
 */
router.post('/matchresults', wrap(async (req, res) => {
	logger.addContext('funcName', 'matchresults[post]');
	
	let event_key = req.event.key;
	const year = req.event.year;
	
	//Get list of matches from the database.
	const matches: Match[] = await utilities.find('matches', {event_key}, {sort: {time: 1}});
	const rankingpoints: RankingPoints = await utilities.findOne('rankingpoints', {year});
	assert(rankingpoints, new e.InternalDatabaseError(`Couldn't find ranking point information for the year ${year}`));
	
	//Build array of each match, from user input
	let userInputGrouped: Dict<StringDict> = {};
	
	//go through body and group every piece of data
	for(let elementName in req.body){
		if (typeof req.body[elementName] !== 'undefined') {
			//console.log(`${elementName}: ${req.body[elementName]}`);
			let elementContents = req.body[elementName];
			
			//match key 2019mrcmp_qm1
			let thisMatchKey = elementName.split('_')[1] + '_' + elementName.split('_')[2];
			//e.g. BlueCompletedRocket or WinningAlliance
			let thisElementType = elementName.split('_')[0];
			
			if (thisMatchKey === '2022flwp_qm25') {
				console.log(thisMatchKey, elementName, elementContents);
			}
			
			//if a match does not exist already, create new obj
			if( !userInputGrouped[thisMatchKey] ){
				userInputGrouped[thisMatchKey] = {};
			}
			//add contents to grouped match info
			userInputGrouped[thisMatchKey][thisElementType] = elementContents;
		}
	}
	
	for(let match of matches){
		let match_key = match.key;
		
		let userInputThisMatch = userInputGrouped[match_key];
		if (!userInputThisMatch) {
			logger.debug(`No user input for match ${match_key}; skipping`);
			continue;
		}
		
		//Modify winning alliance
		switch (userInputThisMatch.WinningAlliance) {
			case 'red': match.winning_alliance = 'red'; break;
			case 'blue': match.winning_alliance = 'blue'; break;
			case '': match.winning_alliance = ''; break;
			default: 
				throw new e.UserError(`Match ${match_key} WinningAlliance invalid (input: ${userInputThisMatch.WinningAlliance})`);
		}
		
		//If score_brakdown has not yet been created, create it now.
		if(!match.score_breakdown){
			match.score_breakdown = {
				blue: {},
				red: {}
			};
		}
		
		// 2022-11-10 JL: removed the check for bluescore/redscore being 0, because sometimes the score CAN be 0
		//Modify blue score
		match.alliances.blue.score = isNaN(parseInt(userInputThisMatch.BlueScore)) ? -1 : parseInt(userInputThisMatch.BlueScore);
		match.score_breakdown.blue.totalPoints = isNaN(parseInt(userInputThisMatch.BlueScore)) ? -1 : parseInt(userInputThisMatch.BlueScore);
		//Modify red score
		match.alliances.red.score = isNaN(parseInt(userInputThisMatch.RedScore)) ? -1 : parseInt(userInputThisMatch.RedScore);
		match.score_breakdown.red.totalPoints = isNaN(parseInt(userInputThisMatch.RedScore)) ? -1 : parseInt(userInputThisMatch.RedScore);
		// Ranking points
		for (let rp of rankingpoints.attributes) {
			match.score_breakdown.blue[rp.name] = !!userInputThisMatch[`Blue${rp.name}`]; // ex: BluecompleteRocketRankingPoint
			match.score_breakdown.red[rp.name] = !!userInputThisMatch[`Red${rp.name}`];
		}
		
		match.manually_entered = true; // 2023-02-20 JL: added manually entered
	}
	
	//Remove matches
	await utilities.remove('matches', {'event_key': event_key});
	
	//Now, insert updated list of matches
	await utilities.insert('matches', matches);
	
	// Recalculate rankings

	// Build an array of objects, one per team
	assert(req.teams, new e.InternalDatabaseError('Teams not found'));
	
	let mapTeamToOrder: Dict<number> = {};
	// let rankArray: Ranking[] = [];
	// 2023-01-09 JL: Temporarily set rankArray to any because the legacy code below adds fields like pointsFor that aren't in the proper schema
	let rankArray: any[] = [];
	for (let i = 0; i < req.teams.length; i++) {
		let team = req.teams[i];
		let thisRank = {
			dq: 0,
			extra_stats: [0],
			matches_played: 0,
			qual_average: null,
			rank: 0,
			record: {
				losses: 0,
				ties: 0,
				wins: 0 },
			sort_orders: [0, 0, 0],
			team_key: team.key,
			event_key: event_key
		};
		rankArray.push(thisRank);
		mapTeamToOrder[team.key] = i;
	}
	logger.trace('rankArray=' + JSON.stringify(rankArray));
	logger.debug('mapTeamToOrder=' + JSON.stringify(mapTeamToOrder));
	
	const rankingPointNames: string[] = [];
	for (let rp of rankingpoints.attributes) {
		rankingPointNames.push(rp.name);
	}
	
	// Go through every match, updating the rank array
	for (let i in matches) {
		let thisMatch = matches[i];
		// 2022-11-10 JL: adding comp_level check because only qualifying matches contribute to rankings
		if (thisMatch.alliances.red.score != -1 && thisMatch.comp_level === 'qm') {
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
			let redRP = 0;
			let blueRP = 0;
			let redWin = 0; let blueWin = 0; let isTie = 0;
			if (thisMatch.winning_alliance == 'red') { redRP = 2; redWin = 1; }
			if (thisMatch.winning_alliance == 'blue') { blueRP = 2; blueWin = 1; }
			if (thisMatch.winning_alliance == '') { redRP = 1; blueRP = 1; isTie = 1; }
			for (let rpName of rankingPointNames) {
				if (thisMatch.score_breakdown.red[rpName]) redRP++;
				if (thisMatch.score_breakdown.blue[rpName]) blueRP++;
			}
			let redScore = thisMatch.alliances.red.score;
			let blueScore = thisMatch.alliances.blue.score;
			
			if (thisMatch.alliances.red.team_keys.includes('frc8324') || thisMatch.alliances.blue.team_keys.includes('frc8324')) {
				console.log(`\nmatch=${thisMatch.match_number}, redWin=${redWin} blueWin=${blueWin}`);
			}

			// red
			for (let j in thisMatch.alliances.red.team_keys) {
				let thisTeamKey = thisMatch.alliances.red.team_keys[j];
				let thisRankIndex = mapTeamToOrder[thisTeamKey];
				assert(rankArray[thisRankIndex]);
				let currentRP = 0; if (rankArray[thisRankIndex].RP) currentRP = rankArray[thisRankIndex].RP;
				let currentMatchesPlayed = 0; if (rankArray[thisRankIndex].matches_played) currentMatchesPlayed = rankArray[thisRankIndex].matches_played;
				let currentWins = 0; let currentLosses = 0; let currentTies = 0;
				if (rankArray[thisRankIndex].record) {
					if (rankArray[thisRankIndex].record.wins) currentWins = rankArray[thisRankIndex].record.wins;
					if (rankArray[thisRankIndex].record.losses) currentLosses = rankArray[thisRankIndex].record.losses;
					if (rankArray[thisRankIndex].record.ties) currentTies = rankArray[thisRankIndex].record.ties;
				}
				let currentPointsFor = 0; if (rankArray[thisRankIndex].pointsFor) currentPointsFor = rankArray[thisRankIndex].pointsFor;
				let currentPointsAgainst = 0; if (rankArray[thisRankIndex].pointsAgainst) currentPointsAgainst = rankArray[thisRankIndex].pointsAgainst;

				currentRP += redRP; let thisRankValueArray = []; thisRankValueArray.push(currentRP);
				currentMatchesPlayed++;
				currentWins += redWin;
				currentLosses += blueWin;
				currentTies += isTie;
				currentPointsFor += redScore;
				currentPointsAgainst += blueScore;
				let thisSortOrders = [];
				thisSortOrders.push(currentRP/currentMatchesPlayed);
				thisSortOrders.push(currentPointsFor);
				thisSortOrders.push(currentPointsAgainst);
				if (thisTeamKey === 'frc8324') {
					console.log(`wins=${currentWins}, losses=${currentLosses}`);
				}

				rankArray[thisRankIndex].matches_played = currentMatchesPlayed;
				rankArray[thisRankIndex].extra_stats = thisRankValueArray;
				rankArray[thisRankIndex].record = {
					losses: currentLosses,
					ties: currentTies,
					wins: currentWins
				};
				rankArray[thisRankIndex].sort_orders = thisSortOrders;

				rankArray[thisRankIndex].RP = currentRP;
				rankArray[thisRankIndex].pointsFor = currentPointsFor;
				rankArray[thisRankIndex].pointsAgainst = currentPointsAgainst;
			}

			// blue
			for (let j in thisMatch.alliances.blue.team_keys) {
				let thisTeamKey = thisMatch.alliances.blue.team_keys[j];
				let thisRankIndex = mapTeamToOrder[thisTeamKey];
				assert(rankArray[thisRankIndex]);
				let currentRP = 0; if (rankArray[thisRankIndex].RP) currentRP = rankArray[thisRankIndex].RP;
				let currentMatchesPlayed = 0; if (rankArray[thisRankIndex].matches_played) currentMatchesPlayed = rankArray[thisRankIndex].matches_played;
				let currentWins = 0; let currentLosses = 0; let currentTies = 0;
				if (rankArray[thisRankIndex].record) {
					if (rankArray[thisRankIndex].record.wins) currentWins = rankArray[thisRankIndex].record.wins;
					if (rankArray[thisRankIndex].record.losses) currentLosses = rankArray[thisRankIndex].record.losses;
					if (rankArray[thisRankIndex].record.ties) currentTies = rankArray[thisRankIndex].record.ties;
				}
				let currentPointsFor = 0; if (rankArray[thisRankIndex].pointsFor) currentPointsFor = rankArray[thisRankIndex].pointsFor;
				let currentPointsAgainst = 0; if (rankArray[thisRankIndex].pointsAgainst) currentPointsAgainst = rankArray[thisRankIndex].pointsAgainst;

				currentRP += blueRP; let thisRankValueArray = []; thisRankValueArray.push(currentRP);
				currentMatchesPlayed++;
				currentWins += blueWin;
				currentLosses += redWin;
				currentTies += isTie;
				currentPointsFor += blueScore;
				currentPointsAgainst += redScore;
				let thisSortOrders = [];
				let rpRatio = currentRP/currentMatchesPlayed;
				thisSortOrders.push(rpRatio);
				thisSortOrders.push(currentPointsFor);
				thisSortOrders.push(currentPointsAgainst);
				if (thisTeamKey === 'frc8324') {
					console.log(`wins=${currentWins}, losses=${currentLosses}`);
				}

				rankArray[thisRankIndex].matches_played = currentMatchesPlayed;
				rankArray[thisRankIndex].extra_stats = thisRankValueArray;
				rankArray[thisRankIndex].record = {
					losses: currentLosses,
					ties: currentTies,
					wins: currentWins
				};
				rankArray[thisRankIndex].sort_orders = thisSortOrders;

				rankArray[thisRankIndex].RP = currentRP;
				//rankArray[thisRankIndex].rpPerMatch = rpRatio;
				rankArray[thisRankIndex].pointsFor = currentPointsFor;
				rankArray[thisRankIndex].pointsAgainst = currentPointsAgainst;
			}
		}
	}
	logger.trace('rankArray=' + JSON.stringify(rankArray));

	// comparator for rankings - generally, higher numbers means 'lower' rank #
	let compareRankings = function(a: Ranking, b: Ranking) {
		if (a.sort_orders && b.sort_orders) {
			if (a.sort_orders[0] < b.sort_orders[0]) return 1;
			if (a.sort_orders[0] > b.sort_orders[0]) return -1;
			if (a.sort_orders[1] < b.sort_orders[1]) return 1;
			if (a.sort_orders[1] > b.sort_orders[1]) return -1;
			if (a.sort_orders[2] < b.sort_orders[2]) return 1;
			if (a.sort_orders[2] > b.sort_orders[2]) return -1;
		}
		// final tiebreaker - inverted (lower team #s -> higher rank)
		let aTeamNum = parseInt(a.team_key.substring(3));
		let bTeamNum = parseInt(b.team_key.substring(3));
		return aTeamNum - bTeamNum;
	};
	// sort the rankings
	let sortedRankArray = rankArray.sort(compareRankings);
	// add in the rank values and event key
	for (let i in sortedRankArray) {
		sortedRankArray[i].rank = parseInt(i) + 1;
		sortedRankArray[i].event_key = event_key;
	}
	logger.trace('sortedRankArray=' + JSON.stringify(sortedRankArray));
	
	// Delete the current rankings
	await utilities.remove('rankings', {'event_key': event_key});
	// Insert into DB
	await utilities.insert('rankings', sortedRankArray);

	//Redirect to updatematches page with success alert.
	res.redirect('/manage/manualdata/matchresults?alert=Updated match data successfully.');
}));

module.exports = router;