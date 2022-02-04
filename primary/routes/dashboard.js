const router = require('express').Router();
const logger = require('log4js').getLogger('dashboard');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const {upload: uploadHelper, matchData: matchDataHelper} = require('@firstteam102/scoutradioz-helpers');
//const matchDataHelper = require('../../scoutradioz-helpers/helpers/matchdatahelper');
//const uploadHelper = require('../../scoutradioz-helpers/helpers/uploadhelper');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require viewer-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_VIEWER)) {
		next();
	}
}));

router.get('/driveteam', wrap(async (req, res) => {
	logger.addContext('funcName', 'driveteam[get]');
	logger.info('ENTER');
	
	var eventKey = req.event.key;
	var eventYear = req.event.year;
	var orgKey = req.user.org_key;
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
	
	logger.debug(`eventKey=${eventKey} orgKey=${orgKey} teamKey=${teamKey}`);
	
	// Get upcoming match data for the specified team (or "all" if no default & none specified)
	var upcomingData = await matchDataHelper.getUpcomingMatchData(eventKey, teamKey);
	// Data for the upcoming matches portion
	var teamRanks = upcomingData.teamRanks;
	var teamNumbers = upcomingData.teamNumbers;
	
	// Pull out the first match (if it exists), get the team keys from the alliances
	var matches = upcomingData.matches;
	
	if (!matches || !matches[0]) throw Error('There are no upcoming matches for team ' + teamKey);
	
	var firstMatch = matches[0];
	
	//2020-03-27 JL: Simplified the way teamKeyList was made
	var redArray = firstMatch.alliances.red.team_keys; 
	var blueArray = firstMatch.alliances.blue.team_keys; 
	var teamKeyList;
	teamKeyList = redArray.join(',');
	teamKeyList += ',0,';
	teamKeyList += blueArray.join(',');
	logger.debug(`teamKeyList=${teamKeyList}`);
	
	// Get the alliance stats
	var allianceStatsData = await matchDataHelper.getAllianceStatsData(eventYear, eventKey, orgKey, teamKeyList, req.cookies);

	//var teams = allianceStatsData.teams;
	var teamList = allianceStatsData.teamList;
	var currentAggRanges = allianceStatsData.currentAggRanges;
	var avgTable = allianceStatsData.avgTable;
	var maxTable = allianceStatsData.maxTable;
	var avgNorms = allianceStatsData.avgNorms;
	var maxNorms = allianceStatsData.maxNorms;

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
				ticks: {
					showLabelBackdrop: false,
					suggestedMin: 0,
					suggestedMax: 1,
					display: false,
				},
				angleLines: {
					display: true,
					color: 'rgb(128, 128, 128)',
				},
				gridLines: {
					color: 'rgb(64, 64, 64)',
				}
			}
		}
	};
	
	// eslint-disable-next-line guard-for-in
	for (let i in dataForChartJS.datasets) {
		let set = dataForChartJS.datasets[i];
		for (let i = 0; i < 3; i++ ) {
			set.red[i] = [];
			set.blue[i] = [];
		}
	}
	
	//Populate labels array
	for (let agg of avgTable) {
		if (agg.hasOwnProperty('key')) {
			var text = agg.key.replace( /([A-Z])/g, ' $1' ); 
			var label = (text.charAt(0).toUpperCase() + text.slice(1)).split(' ');
			dataForChartJS.labels.push(label);
		}
	}
	
	//Avg norms
	for (let agg of avgNorms) {
		for (let i in teamList) {
			if (agg.hasOwnProperty(teamList[i])) {
				let team = teamList[i];
				//red
				if (i < 3) {
					let thisDatum = agg[team];
					dataForChartJS.datasets.avg.red[i].push(thisDatum);
				}
				//blue
				else {
					let thisDatum = agg[team];
					dataForChartJS.datasets.avg.blue[i - 4].push(thisDatum);
				}
			}
		}
	}
	//Max norms
	for (let agg of maxNorms) {
		for (let i in teamList) {
			if (agg.hasOwnProperty(teamList[i])) {
				let team = teamList[i];
				//red
				if (i < 3) {
					let thisDatum = agg[team];
					dataForChartJS.datasets.max.red[i].push(thisDatum);
				}
				//blue
				else {
					let thisDatum = agg[team];
					dataForChartJS.datasets.max.blue[i - 4].push(thisDatum);
				}
			}
		}
	}	
	
	res.render('./dashboard/driveteam', {
		title: 'Drive Team Dashboard',
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

router.all('/*', wrap(async (req, res, next) => {
	//Require scouter-level authentication for every method in this route BELOW this method.
	if (await req.authenticate (process.env.ACCESS_SCOUTER)) {
		next();
	}
}));

/**
 * Scouter's dashboard page. Provides a scouter's assigned teams for scouting and assigned matches for scoring
 * @url /dashboard
 * @view dashboard/index
 */
router.get('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[get]');
	logger.info('ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	var org_key = req.user.org_key;

	// for later querying by event_key
	var eventKey = req.event.key;

	// start by assuming this user has no assignments
	var noAssignments = true;

	// Check to see if the logged in user is one of the scouting/scoring assignees
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var assignedTeams = await utilities.find('pitscouting', {
		'org_key': org_key, 
		'event_key': eventKey, 
		'primary': thisUserName
	}, {
		sort: { 'team_key': 1 }
	});

	// 2020-03-07, M.O'C: Allowing for scouts assigned to matches but NOT to pits
	if (assignedTeams.length == 0) {
		var assignedMatches = await utilities.find('matchscouting', {
			org_key: org_key, 
			event_key: eventKey, 
			assigned_scorer: thisUserName
		});
		if (assignedMatches.length > 0)
			noAssignments = false;		
	}
	else
		noAssignments = false;

	// if no assignments, send off to unassigned
	//if (assignedTeams.length == 0) {
	if (noAssignments) {
		logger.debug('User \'' + thisUserName + '\' has no assigned teams');
		res.redirect('./dashboard/unassigned');
		return;
	}
	for (var assignedIdx = 0; assignedIdx < assignedTeams.length; assignedIdx++)
		logger.trace('assignedTeam[' + assignedIdx + ']=' + assignedTeams[assignedIdx].team_key + '; data=' + assignedTeams[assignedIdx].data);

	// Get their scouting team
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	var pairsData = await utilities.find('scoutingpairs', { 'org_key': org_key, 
		$or:
			[{'member1': thisUserName},
				{'member2': thisUserName},
				{'member3': thisUserName}]
	}, {});

	var backupTeams = [];
	var thisPairLabel = 'Not assigned to pit scouting';
	if (pairsData.length > 0) {
		// we assume they're in a pair!
		var thisPair = pairsData[0];
		
		//Sets up pair label
		thisPairLabel = thisPair.member1;
		if (thisPair.member2)
			thisPairLabel = thisPairLabel + ', ' + thisPair.member2;
		if (thisPair.member3)
			thisPairLabel = thisPairLabel + ', ' + thisPair.member3;
		
		//Get teams where they're backup (if any) from scout data collection
		// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
		backupTeams = await utilities.find('pitscouting', {
			'org_key': org_key, 
			'event_key': eventKey,
			$or:
				[{'secondary': thisUserName},
					{'tertiary': thisUserName}]
		}, {
			sort: {'team_key': 1} 
		});
			
		//logs backup teams to console
		for (var backupIdx = 0; backupIdx < backupTeams.length; backupIdx++)
			logger.trace('backupTeam[' + backupIdx + ']=' + backupTeams[backupIdx].team_key);
	}

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matchDocs = await utilities.find('matches', {
		event_key: eventKey, 
		'alliances.red.score': -1
	},{
		sort: {'time': 1}
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
			//logger.debug('associating ' + matches[matchIdx].predicted_time + ' with ' + matches[matchIdx].key);
			matchLookup[matchDocs[matchIdx].key] = matchDocs[matchIdx];
		}
		
	// Get all the UNRESOLVED matches where they're set to score
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoringMatches = await utilities.find('matchscouting', {
		'org_key': org_key, 
		'event_key': eventKey, 
		'assigned_scorer': thisUserName, 
		'time': { $gte: earliestTimestamp }
	}, { 
		limit: 10, 
		sort: {'time': 1} 
	});

	for (var matchesIdx = 0; matchesIdx < scoringMatches.length; matchesIdx++)
		logger.trace('scoringMatch[' + matchesIdx + ']: num,team=' + scoringMatches[matchesIdx].match_number + ',' + scoringMatches[matchesIdx].team_key);

	for (var scoreIdx = 0; scoreIdx < scoringMatches.length; scoreIdx++) {
		//logger.debug('getting for ' + scoreData[scoreIdx].match_key);
		if (scoringMatches[scoreIdx] && scoringMatches[scoreIdx] && matchLookup[scoringMatches[scoreIdx].match_key])
			scoringMatches[scoreIdx].predicted_time = matchLookup[scoringMatches[scoreIdx].match_key].predicted_time;
	}
	
	res.render('./dashboard/index',{
		title: 'Dashboard for '+thisUserName,
		'thisPair': thisPairLabel,
		'assignedTeams': assignedTeams,
		'backupTeams': backupTeams,
		'scoringMatches': scoringMatches
	});
}));

/**
 * Page for unassigned scorers. Provides links to one-off score matches or scout teams.
 * @url /dashboard/unassigned
 * @view dashboard/unassigned
 */
router.get('/unassigned', wrap(async (req, res) => {
	logger.addContext('funcName', 'unassigned[get]');
	logger.info('ENTER');
	
	res.render('./dashboard/unassigned',{
		title: 'Unassigned'
	});	
}));

/**
 * Alliance selection page
 * @url /dashboard/allianceselection
 * @view dashboard/allianceselection
 */
router.get('/allianceselection', wrap(async (req, res) => {
	logger.addContext('funcName', 'allianceselection[get]');
	logger.info('ENTER');
	
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// 2019-11-11 JL: Put everything inside a try/catch block with error conditionals throwing
	try {
		
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
		//var rankings = await utilities.find("currentrankings", {}, {});
		var rankings = await utilities.find('rankings', {'event_key': event_key}, {});
		if(!rankings[0])
			throw 'Couldn\'t find rankings in allianceselection';
		
		var alliances = [];
		for(let i = 0; i < 8; i++){
			alliances[i] = {
				team1: rankings[i].team_key,
				team2: undefined,
				team3: undefined
			};
		}
			
		var rankMap = {};
		for (var rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
			//logger.debug('rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
			rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
		}
	
		// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
		var cookie_key = org_key + '_' + event_year + '_cols';
		var colCookie = req.cookies[cookie_key];
		var scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
			
		if(!scoreLayout[0])
			throw 'Couldn\'t find scoringlayout in allianceselection';
		
		//initialize aggQuery
		var aggQuery = [];
		//add $match > event_key
		aggQuery.push({ $match : { 'org_key': org_key, 'event_key': event_key } });
		//initialize groupClause
		var groupClause = {};
		//group teams for 1 row per team
		groupClause['_id'] = '$team_key';
		
		//iterate through scoringlayout
		for (let scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
			//pull this layout element from score layout
			let thisLayout = scoreLayout[scoreIdx];
			thisLayout.key = thisLayout.id;
			scoreLayout[scoreIdx] = thisLayout;
			//if it is a valid data type, add this layout's ID to groupClause
			//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
			if (matchDataHelper.isQuantifiableType(thisLayout.type))
				groupClause[thisLayout.id] = {$avg: '$data.' + thisLayout.id};
		}
		//add $group > groupClause (Layout w/ data)
		aggQuery.push({ $group: groupClause });
		//add $sort > sort request
		// aggQuery.push({ $sort: { rank: 1 } }); JL: Unneeded sort (rank is not an element of these objects)
		
		//Aggregate with this query we made
		// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
		var aggArray = await utilities.aggregate('matchscouting', aggQuery);
		if(!aggArray[0])
			throw 'Couldn\'t find scoringdata in allianceselection';
		
		// Rewrite data into display-friendly values
		for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
			//get thisAgg
			var thisAgg = aggArray[aggIdx];
			for (let scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
				let thisLayout = scoreLayout[scoreIdx];
				//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
				if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
					var roundedVal = (Math.round(thisAgg[thisLayout.id] * 10)/10).toFixed(1);
					thisAgg[thisLayout.id] = roundedVal;
				}
			}
			if(!rankMap[thisAgg._id] || !rankMap[thisAgg._id].value){
				//return res.redirect("/?alert=Make sure that team rankings have been pulled from TheBlueAlliance");
				logger.trace(`Gonna crash w/ id ${thisAgg._id}`);
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
		for(let i = 8; i < rankings.length; i++){
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
			}
			else{
				return 1;
			}
		});
		
		logger.trace(sortedTeams);
	
		// read in the current agg ranges
		// 2020-02-08, M.O'C: Tweaking agg ranges
		// var currentAggRanges = await utilities.find("currentaggranges", {}, {});
		var currentAggRanges = await utilities.find('aggranges', {'org_key': org_key, 'event_key': event_key});
	
		//logger.debug('aggArray=' + JSON.stringify(aggArray));
		res.render('./dashboard/allianceselection', {
			title: 'Alliance Selection',
			rankings: rankings,
			alliances: alliances,
			aggdata: aggArray,
			currentAggRanges: currentAggRanges,
			layout: scoreLayout,
			sortedTeams: sortedTeams,
			matchDataHelper: matchDataHelper
		});
	}
	catch (err) {
		logger.error(err);
		throw err;
	}
}));

router.get('/pits', wrap(async (req, res) => {
	logger.addContext('funcName', 'pits[get]');
	logger.info('ENTER');
	
	// are we asking for pictures?
	var loadPhotos = req.query.loadPhotos;

	// for later querying by event_key
	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var teams = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key}, { });
		
	//sort teams list by number
	teams.sort(function(a, b) {
		let aNum = parseInt(a.team_key.substring(3));
		let bNum = parseInt(b.team_key.substring(3));
		return aNum - bNum;
	});
	
	// read in team list for data
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	var thisEvent = await utilities.findOne('events', 
		{'key': event_key}, {},
		{allowCache: true}
	);
	var teamArray = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0) {

		logger.debug('thisEvent.team_keys=' + JSON.stringify(thisEvent.team_keys));
		teamArray = await utilities.find('teams', 
			{'key': {$in: thisEvent.team_keys}}, {sort: {team_number: 1}},
			{allowCache: true}
		);
	}

	// Build map of team_key -> team data
	var teamKeyMap = {};
	for (let teamIdx = 0; teamIdx < teamArray.length; teamIdx++) {
		//logger.debug('teamIdx=' + teamIdx + ', teamArray[]=' + JSON.stringify(teamArray[teamIdx]));
		teamKeyMap[teamArray[teamIdx].key] = teamArray[teamIdx];
	}

	// Add data to 'teams' data
	for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
		//logger.debug('teams[teamIdx]=' + JSON.stringify(teams[teamIdx]) + ', teamKeyMap[teams[teamIdx].team_key]=' + JSON.stringify(teamKeyMap[teams[teamIdx].team_key]));
		teams[teamIdx].nickname = teamKeyMap[teams[teamIdx].team_key].nickname;
	}
	//Add a call to the database for populating menus in pit scouting
	var teamKeys = [];
	for (var team of teamArray) {
		if (team.hasOwnProperty('key')) teamKeys.push(team.key);
	}
	
	var images;
	
	if (loadPhotos == true) {
		images = await uploadHelper.findTeamImagesMultiple(org_key, event_year, teamKeys);
	}
	
	res.render('./dashboard/pits', {
		title: 'Pit Scouting',
		teamAssignments: teams,
		images: images
	});	
}));

router.get('/matches', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[get]');
	logger.info('ENTER');

	// for later querying by event_key
	var eventKey = req.event.key;
	var org_key = req.user.org_key;

	logger.info('ENTER org_key=' + org_key + ',eventKey=' + eventKey);

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matches = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': -1 },{sort: {'time': 1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (matches && matches[0]) {
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	// 2018-04-05, M.O'C - Adding 'predicted time' to a map for later enriching of 'scoreData' results
	var matchLookup = {};
	if (matches)
		for (var matchIdx = 0; matchIdx < matches.length; matchIdx++) {
			//logger.debug('associating ' + matches[matchIdx].predicted_time + ' with ' + matches[matchIdx].key);
			matchLookup[matches[matchIdx].key] = matches[matchIdx];
		}

	logger.debug('earliestTimestamp=' + earliestTimestamp);

	// Get all the UNRESOLVED matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoreData = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $gte: earliestTimestamp }}, { limit: 60, sort: {'time': 1, 'alliance': 1, 'team_key': 1} });

	if(!scoreData)
		return logger.error('mongo error at dashboard/matches');

	logger.debug('scoreData.length=' + scoreData.length);

	for (var scoreIdx = 0; scoreIdx < scoreData.length; scoreIdx++) {
		//logger.debug('getting for ' + scoreData[scoreIdx].match_key);
		if (scoreData[scoreIdx] && matchLookup[scoreData[scoreIdx].match_key])
			scoreData[scoreIdx].predicted_time = matchLookup[scoreData[scoreIdx].match_key].predicted_time;
	}
	
	logger.trace('DEBUG getting nicknames next?');

	// read in team list for data
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	//var teamArray = await utilities.find("currentteams", {},{ sort: {team_number: 1} });
	var thisEvent = await utilities.findOne('events', 
		{'key': eventKey}, {},
		{allowCache: true}
	);
	if (!thisEvent) throw 'Could not find event in db';
	
	var teamArray;
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0) {
		logger.debug('thisEvent.team_keys=' + JSON.stringify(thisEvent.team_keys));
		teamArray = await utilities.find('teams', 
			{'key': {$in: thisEvent.team_keys}}, 
			{sort: {team_number: 1}},
			{allowCache: true}
		);
	}
	if (!teamArray) throw Error('Could not find list of teams at this event');
		
	// Build map of team_key -> team data
	var teamKeyMap = {};
	for (var teamIdx = 0; teamIdx < teamArray.length; teamIdx++) {
		//logger.debug('teamIdx=' + teamIdx + ', teamArray[]=' + JSON.stringify(teamArray[teamIdx]));
		teamKeyMap[teamArray[teamIdx].key] = teamArray[teamIdx];
	}
	
	for(var i in scoreData) {
		if (teamKeyMap[scoreData[i].team_key]) {
			scoreData[i].team_nickname = teamKeyMap[scoreData[i].team_key].nickname;
		}
		else {
			scoreData[i].team_nickname = 'None';
		}
	}
	//this line has a definition problem ^
	logger.debug('scoreData.length=' + scoreData.length);
	res.render('./dashboard/matches',{
		title: 'Match Scouting',
		matches: scoreData
	});
}));

module.exports = router;
