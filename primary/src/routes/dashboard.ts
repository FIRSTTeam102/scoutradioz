import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../helpers/permissions';
import { upload as uploadHelper, matchData as matchDataHelper } from 'scoutradioz-helpers';
import e from 'scoutradioz-http-errors';
import type { MongoDocument } from 'scoutradioz-utilities';
import type { Match, PitScouting, MatchScouting, ScoutingPair, Ranking, TeamKey, Team, AggRange, Event, HeatMapColors,} from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('dashboard');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require viewer-level authentication for every method in this route.
	if (await req.authenticate(Permissions.ACCESS_VIEWER)) {
		let cookieKey= 'scoutradiozheatmap';
		if (req.cookies[cookieKey]) {
			logger.trace('req.cookies[cookie_key]=' + JSON.stringify(req.cookies[cookieKey]));
			let heatMapColors: HeatMapColors = await utilities.findOne('heatmapcolors',
				{key: req.cookies[cookieKey]}, 
				{},
				{allowCache: true}
			);
			res.locals.heatMapColors= heatMapColors;
		}
		next();
	} 
}));

router.get('/driveteam', wrap(async (req, res) => {
	logger.addContext('funcName', 'driveteam[get]');
	logger.info('ENTER');
	
	let eventKey = req.event.key;
	let eventYear = req.event.year;
	let thisUser = req._user;
	let orgKey = thisUser.org_key;
	let teamKey;
	let noMatchesFoundForTeam = false; // 2022-03-02 JL: To let view know if matches were not found for the team
	
	//set teamKey to query or org default
	// 2022-03-16 JL: Adding an "all" button
	// 2024-04-04 JL: Added cookie to store which team key (of the team keys in the org) we think the user belongs to
	let teamKeyCookie = req.cookies['selectedTeamKey'];
	if (req.query.all) {
		teamKey = 'all';
	}
	else if (typeof req.query.team_key === 'string') {
		teamKey = req.query.team_key;
		if (thisUser.org.team_keys?.includes(teamKey)) {
			logger.debug('Setting teamKey cookie from query parameter because it\'s in the org\'s list of team_keys');
			res.cookie('selectedTeamKey', teamKey);
		}
	}
	else if (teamKeyCookie && thisUser.org.team_keys?.includes(teamKeyCookie)) {
		logger.debug(`Setting teamKey to ${teamKeyCookie} from cookie`);
		teamKey = teamKeyCookie;
	}
	else if (thisUser.org.team_key) {
		logger.debug(`Setting teamKey ${teamKey} from org team key`);
		teamKey = thisUser.org.team_key;
	}
	else {
		teamKey = 'all';
	}
	
	let orgTeamKeys = [];
	if (req._user.org.team_key) orgTeamKeys.push(req._user.org.team_key);
	if (req._user.org.team_keys) orgTeamKeys.push(...req._user.org.team_keys);
	
	// Remove team key cookie if it's set but isn't inside the list of team_keys the org has
	if (teamKeyCookie && !thisUser.org.team_keys?.includes(teamKeyCookie)) {
		logger.info(`teamKeyCookie ${teamKeyCookie} not in list of org keys; removing cookie`);
		res.clearCookie('selectedTeamKey');
	}
	
	logger.debug(`eventKey=${eventKey} orgKey=${orgKey} teamKey=${teamKey}`);
	
	// Get upcoming match data for the specified team (or "all" if no default & none specified)
	let upcomingData = await matchDataHelper.getUpcomingMatchData(eventKey, teamKey, orgKey);
	
	// Pull out the first match (if it exists), get the team keys from the alliances
	let matches = upcomingData.matches;
	
	// 2022-03-02 JL: Don't want to throw an error if the current team has no matches; Instead, default to "all"
	if (!matches || !matches[0] && teamKey !== 'all') {
		logger.debug(`No matches found for team ${teamKey}; attempting "all"`);
		noMatchesFoundForTeam = true;
		upcomingData = await matchDataHelper.getUpcomingMatchData(eventKey, 'all', orgKey);
		matches = upcomingData.matches;
	}
	// If there are still no matches, then render the page with an error
	if (!matches || !matches[0]) {
		logger.debug('No upcoming matches found for the event');
		return res.render('./dashboard/driveteam', {
			title: res.msg('driveDashboard.title'),
			selectedTeam: 'all',
			orgTeamKeys,
		});
	}
	
	// Data for the upcoming matches portion
	let teamRanks = upcomingData.teamRanks;
	let teamNumbers = upcomingData.teamNumbers;
	
	let firstMatch = matches[0];
	
	//2020-03-27 JL: Simplified the way teamKeyList was made
	let redArray = firstMatch.alliances.red.team_keys; 
	let blueArray = firstMatch.alliances.blue.team_keys; 
	let teamKeyList;
	teamKeyList = redArray.join(',');
	teamKeyList += ',0,';
	teamKeyList += blueArray.join(',');
	logger.debug(`teamKeyList=${teamKeyList}`);
	
	// Get the alliance stats
	let allianceStatsData = await matchDataHelper.getAllianceStatsData(eventYear, eventKey, orgKey, teamKeyList, req.cookies);

	//var teams = allianceStatsData.teams;
	let teamList = allianceStatsData.teamList;
	let currentAggRanges = allianceStatsData.currentAggRanges;
	let avgTable = allianceStatsData.avgTable;
	let maxTable = allianceStatsData.maxTable;
	let avgNorms = allianceStatsData.avgNorms;
	let maxNorms = allianceStatsData.maxNorms;
	// 2024-02-07, M.O'C: Adding super-scout notes
	let pitData = allianceStatsData.pitData;

	let dataForChartJS: ChartJSData = {
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
			avg: {red: [[], [], []], blue: [[], [], []]},
			max: {red: [[], [], []], blue: [[], [], []]},
			sum: {red: [[], [], []], blue: [[], [], []]},
		},
		options: {
			scales: {
				r: {	
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
					grid: {
						color: 'rgb(64, 64, 64)',
					}
				}
			}
		}
	};
	
	// for (let i in dataForChartJS.datasets) {
	// 	let set = dataForChartJS.datasets[i];
	// 	for (let i = 0; i < 3; i++ ) {
	// 		set.red[i] = [];
	// 		set.blue[i] = [];
	// 	}
	// }
	
	//Populate labels array
	for (let agg of avgTable) {
		if (agg.hasOwnProperty('key')) {
			let text = agg.key.replace( /([A-Z])/g, ' $1' ); 
			let label = (text.charAt(0).toUpperCase() + text.slice(1)).split(' ');
			dataForChartJS.labels.push(label);
			logger.trace(label, agg);
		}
	}
	
	//Avg norms
	for (let agg of avgNorms) {
		for (let i = 0; i < teamList.length; i++) {
			if (agg.hasOwnProperty(teamList[i])) {
				let team = teamList[i];
				//red
				if (i < 3) {
					let thisDatum = parseFloat(agg[team]);
					dataForChartJS.datasets.avg.red[i].push(thisDatum * 100);
					// 2022-03-19 JL: Multiplying the data by 100 to show them as a sort of percent
				}
				//blue
				else {
					let thisDatum = parseFloat(agg[team]);
					dataForChartJS.datasets.avg.blue[i - 4].push(thisDatum * 100);
				}
			}
		}
	}
	//Max norms
	for (let agg of maxNorms) {
		for (let i = 0; i < teamList.length; i++) {
			if (agg.hasOwnProperty(teamList[i])) {
				let team = teamList[i];
				//red
				if (i < 3) {
					let thisDatum = parseFloat(agg[team]);
					dataForChartJS.datasets.max.red[i].push(thisDatum * 100);
				}
				//blue
				else {
					let thisDatum = parseFloat(agg[team]);
					dataForChartJS.datasets.max.blue[i - 4].push(thisDatum * 100);
				}
			}
		}
	}
	
	res.render('./dashboard/driveteam', {
		title: res.msg('driveDashboard.title'),
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
		orgTeamKeys,
		noMatchesFoundForTeam: noMatchesFoundForTeam,
		dataForChartJS: JSON.stringify(dataForChartJS),
		pitData: pitData
	});
}));

router.all('/*', wrap(async (req, res, next) => {
	//Require scouter-level authentication for every method in this route BELOW this method.
	if (await req.authenticate (Permissions.ACCESS_SCOUTER)) {
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
	
	let thisUser = req._user;
	let thisUserName = thisUser.name;
	let thisUserId = thisUser._id;
	let org_key = thisUser.org_key;

	// for later querying by event_key
	let eventKey = req.event.key;

	// start by assuming this user has no assignments
	let noAssignments = true;

	// Check to see if the logged in user is one of the scouting/scoring assignees
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	// 2023-02-13 JL: Sorting manually by team number in JS
	let assignedTeams: PitScouting[] = await utilities.find('pitscouting', {
		'org_key': org_key, 
		'event_key': eventKey, 
		'primary.id': thisUserId
	});
	
	const teamKeySort = (a: PitScouting, b: PitScouting) => parseInt(a.team_key.substring(3)) - parseInt(b.team_key.substring(3));
	assignedTeams.sort(teamKeySort);

	// 2020-03-07, M.O'C: Allowing for scouts assigned to matches but NOT to pits
	if (assignedTeams.length == 0) {
		let assignedMatches: MatchScouting[] = await utilities.find('matchscouting', {
			org_key: org_key, 
			event_key: eventKey, 
			'assigned_scorer.id': thisUserId
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
		let alert = req.query.alert; // in case they were sent to the dashboard with an alert
		let redirect = req.getURLWithQueryParameters('/dashboard/unassigned', {alert: alert});
		res.redirect(redirect);
		return;
	}
	for (let assignedIdx = 0; assignedIdx < assignedTeams.length; assignedIdx++)
		logger.trace('assignedTeam[' + assignedIdx + ']=' + assignedTeams[assignedIdx].team_key + '; data=' + assignedTeams[assignedIdx].data);

	// Get their scouting team
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	let pairsData: ScoutingPair[] = await utilities.find('scoutingpairs', { 'org_key': org_key, 
		$or:
			[{'member1.id': thisUserId},
				{'member2.id': thisUserId},
				{'member3.id': thisUserId}]
	}, {});

	let backupTeams: PitScouting[] = [];
	let thisPairLabel = res.msg('dashboard.notPitAssigned');
	if (pairsData.length > 0) {
		// we assume they're in a pair!
		let thisPair = pairsData[0];
		
		//Sets up pair label
		thisPairLabel = thisPair.member1.name;
		if (thisPair.member2)
			thisPairLabel = thisPairLabel + ', ' + thisPair.member2.name;
		if (thisPair.member3)
			thisPairLabel = thisPairLabel + ', ' + thisPair.member3.name;
		
		//Get teams where they're backup (if any) from scout data collection
		// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
		// 2023-02-13 JL: Sorting manually by team number in JS
		backupTeams = await utilities.find('pitscouting', {
			'org_key': org_key, 
			'event_key': eventKey,
			$or:
				[{'secondary.id': thisUserId},
					{'tertiary.id': thisUserId}]
		});
		
		backupTeams.sort(teamKeySort);
			
		//logs backup teams to console
		for (let backupIdx = 0; backupIdx < backupTeams.length; backupIdx++)
			logger.trace('backupTeam[' + backupIdx + ']=' + backupTeams[backupIdx].team_key);
	}

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	// 2024-01-27, M.O'C: Switch to *max* time of *resolved* matches [where alliance scores != -1]
	let matchDocs: Match[] = await utilities.find('matches', {
		event_key: eventKey, 
		'alliances.red.score': {$ne: -1}
	},{
		sort: {'time': -1}
	});
	// 2024-04-04, M.O'C: Also get the *unresolved* matches (for 'comp_level')
	let unresolvedMatches: Match[] = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': {$eq: -1} },{sort: {'time': -1}});
		
	// 2024-02-06, M.O'C: Have to change 'latestTimestamp' to be *early* UNLESS matches have been played
	let latestTimestamp = 1234;
	if (matchDocs && matchDocs[0]){
		let latestMatch = matchDocs[0];
		latestTimestamp = latestMatch.time + 1;
	}

	// 2018-04-05, M.O'C - Adding 'predicted time' to a map for later enriching of 'scoreData' results
	let matchLookup: Dict<Match> = {};
	if (matchDocs)
		for (let matchIdx = 0; matchIdx < matchDocs.length; matchIdx++) {
			//logger.debug('associating ' + matches[matchIdx].predicted_time + ' with ' + matches[matchIdx].key);
			matchLookup[matchDocs[matchIdx].key] = matchDocs[matchIdx];
		}
	// 2024-04-04, M.O'C - Also build a map of *unresolved* matches
	let unresolvedMatchLookup: Dict<Match> = {};
	if (unresolvedMatches)
		for (let matchIdx = 0; matchIdx < unresolvedMatches.length; matchIdx++) {
			//logger.debug(`matches[matchIdx].key=${unresolvedMatches[matchIdx].key}`);
			unresolvedMatchLookup[unresolvedMatches[matchIdx].key] = unresolvedMatches[matchIdx];
		}
		
	// Get all the UNRESOLVED matches where they're set to score
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scoringMatches: (MatchScouting & {comp_level?: string, set_number?: number})[] = await utilities.find('matchscouting', {
		'org_key': org_key, 
		'event_key': eventKey, 
		'assigned_scorer.id': thisUserId, 
		'time': { $gte: latestTimestamp }
	}, { 
		limit: 15, 
		sort: {'time': 1} 
	});

	for (let matchesIdx = 0; matchesIdx < scoringMatches.length; matchesIdx++)
		logger.trace('scoringMatch[' + matchesIdx + ']: num,team=' + scoringMatches[matchesIdx].match_number + ',' + scoringMatches[matchesIdx].team_key);

	for (let scoreIdx = 0; scoreIdx < scoringMatches.length; scoreIdx++) {
		//logger.debug('getting for ' + scoreData[scoreIdx].match_key);
		if (scoringMatches[scoreIdx] && scoringMatches[scoreIdx] && matchLookup[scoringMatches[scoreIdx].match_key])
			// @ts-ignore - JL note: don't wanna bother with this rn
			scoringMatches[scoreIdx].predicted_time = matchLookup[scoringMatches[scoreIdx].match_key].predicted_time;
		// 2024-04-04, M.O'C: While we're here... also pass up the 'comp_level' of the match
		if (scoringMatches[scoreIdx].match_key && unresolvedMatchLookup[scoringMatches[scoreIdx].match_key]) {
			scoringMatches[scoreIdx].comp_level = unresolvedMatchLookup[scoringMatches[scoreIdx].match_key].comp_level;
			scoringMatches[scoreIdx].set_number = unresolvedMatchLookup[scoringMatches[scoreIdx].match_key].set_number;
			//logger.debug(`comp_level=${scoreData[i].comp_level}`);
		}
		else {
			logger.debug(`scoringMatches[i].match_key=${scoringMatches[scoreIdx].match_key} & ${(scoringMatches[scoreIdx].match_key ? unresolvedMatchLookup[scoringMatches[scoreIdx].match_key] : '(nvrmind)')}`);
		}
	}
	
	res.render('./dashboard/index',{
		title: res.msg('dashboard.titleUser', {user: thisUserName}),
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
		title: res.msg('dashboard.unassigned')
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
	
	let event_key = req.event.key;
	let event_year = req.event.year;
	let thisUser = req._user;
	let org_key = thisUser.org_key;

	let numAlliances = typeof req.query.numAlliances === 'string'
		? parseInt(req.query.numAlliances) : 8;
	let numRounds = typeof req.query.numRounds === 'string'
		? parseInt(req.query.numRounds) : 3;
	logger.debug(`numAlliances: ${numAlliances}, numRounds: ${numRounds}`);
	
	// 2024-04-04 JL: Added multiple picklists
	// Check which team_key has been specified, if any, being one of the team_keys of the org
	//- JL note: (maybe TODO between seasons): when picklist_key is undefined and team_keys.length > 1, it still loads orgteamvalues with picklist_key undefined, and loads data even though it wont' be displayed
	let picklist_key: string|undefined = undefined;
	if (typeof req.query.picklist_key === 'string') picklist_key = req.query.picklist_key;
	if (picklist_key && !(req._user.org.team_keys?.includes(picklist_key))) throw new e.UserError(`Team key ${picklist_key} specified but it is not in your org's list of team_keys!`);

	// 2019-03-21, M.O'C: Utilize the currentaggranges
	// 2019-11-11 JL: Put everything inside a try/catch block with error conditionals throwing
	try {
		
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
		let rankings: Ranking[] = await utilities.find('rankings', {'event_key': event_key}, { sort: {'rank': 1} });
		if(!rankings[0]) {
			// throw new e.InternalServerError('Couldn\'t find rankings in allianceselection');
			res.render('./message',{
				title: res.msg('allianceselection.title'),
				message: res.msg('allianceselection.noRankings'),
			});
			return;
		}
		// 2023-03-27, M.O'C: Scan the rankings to make sure all the data has come in
		let firstCount = rankings[0].matches_played;
		let matchcountConsistent = true;
		for(let i = 1; i < rankings.length; i++){
			let thisCount = rankings[i].matches_played;
			if (thisCount != firstCount) {
				matchcountConsistent = false;
				break;
			}
		}

		// numAlliances is ~usually~ 8, but in some cases - e.g. 2022bcvi - there are fewer
		let alliances: TeamKey[][] = [];
		for (let i = 0; i < numAlliances; i++) {
			// @ts-ignore
			alliances[i] = [].fill(numRounds);
			alliances[i][0] = rankings[i].team_key; // preload first team 
		}
		logger.debug(`alliances=${JSON.stringify(alliances)}`);
			
		let rankMap: Dict<Ranking> = {};
		for (let rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
			//logger.debug('rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
			rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
		}
	
		// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
		let cookie_key = org_key + '_' + event_year + '_cols';
		let colCookie = req.cookies[cookie_key];
		let scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
			
		if(!scoreLayout[0])
			throw 'Couldn\'t find scoringlayout in allianceselection';
		
		//initialize aggQuery
		let aggQuery = [];
		//add $match > event_key
		aggQuery.push({ $match : { 'org_key': org_key, 'event_key': event_key } });

		// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
		//get the alpha from the process.env
		if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not set!');
		let emaAlpha = parseFloat(process.env.EMA_ALPHA);
		
		//initialize setWindowFieldsClause
		let setWindowFieldsClause: MongoDocument = {};
		setWindowFieldsClause['partitionBy'] = '$team_key';
		let sortField: MongoDocument = {};
		sortField['time'] = 1;
		setWindowFieldsClause['sortBy'] = sortField;
		let outputClause: MongoDocument = {};
		//iterate through scoringlayout
		for (let scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
			//pull this layout element from score layout
			let thisLayout = scoreLayout[scoreIdx];
			thisLayout.key = thisLayout.id;
			scoreLayout[scoreIdx] = thisLayout;
			//if it is a valid data type, add this layout's ID to groupClause
			if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
				let thisEMAclause: MongoDocument = {};
				let thisEMAinner: MongoDocument = {};
				thisEMAinner['alpha'] = emaAlpha;
				thisEMAinner['input'] = '$data.' + thisLayout.id;
				thisEMAclause['$expMovingAvg'] = thisEMAinner;
				outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
			}
		}
		setWindowFieldsClause['output'] = outputClause;
		logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
		aggQuery.push({$setWindowFields: setWindowFieldsClause});
		
		//initialize groupClause
		let groupClause: MongoDocument = {};
		//group teams for 1 row per team
		groupClause['_id'] = '$team_key';
		
		//iterate through scoringlayout
		for (let scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
			//pull this layout element from score layout
			let thisLayout = scoreLayout[scoreIdx];
			thisLayout.key = thisLayout.id;
			scoreLayout[scoreIdx] = thisLayout;
			//if it is a valid data type, add this layout's ID to groupClause
			if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
				// 2022-03-13 JL: Unlike on other pages like allteammetrics, the main focus of these data are the averages (instead of being switchable). 
				//	Therefore, keeping the avg as .id and adding MAX as an "option" (to be displayed small on the table)
				// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
				groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
				//groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
				groupClause[thisLayout.id + 'MAX'] = {$maxN: {'input': '$data.' + thisLayout.id, 'n': 12}};
			}
		}
		//add $group > groupClause (Layout w/ data)
		aggQuery.push({ $group: groupClause });
		
		// 2022-03-03 JL: Looking up team values in the aggregate query
		aggQuery.push({ $lookup: {
			from: 'orgteamvalues',
			let: {team_key: '$_id'},
			pipeline: [
				{$match: {$expr: {$and: [
					{$eq: ['$team_key', '$$team_key']},
					{$eq: ['$org_key', org_key]},
					{$eq: ['$event_key', event_key]},
					{$eq: ['$picklist_key', picklist_key]}, // 2024-04-04 JL: added picklist_key
				]}}},
				{$project: {_id: 0, team_key: 0, event_key: 0, org_key: 0}}
			],
			as: 'value'
		}});
		// The lookup returns an array of elements, so turn value: [{value: 1}] into value: 1
		aggQuery.push({ $set: {'value': {$first: '$value'}} });
		aggQuery.push({ $set: {'value': '$value.value'} });
		
		//Aggregate with this query we made
		// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
		let aggArray = await utilities.aggregate('matchscouting', aggQuery);
		if(!aggArray[0])
			throw 'Couldn\'t find scoringdata in allianceselection';
		
		// Rewrite data into display-friendly values
		for (let aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
			//get thisAgg
			let thisAgg = aggArray[aggIdx];
			for (let scoreIdx = 0; scoreIdx < scoreLayout.length; scoreIdx++) {
				let thisLayout = scoreLayout[scoreIdx];
				if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
					let roundedValAvg = (Math.round(thisAgg[thisLayout.id + 'AVG'] * 10)/10).toFixed(1);
					let maxVal = matchDataHelper.extractPercentileFromSortedArray(thisAgg[thisLayout.id + 'MAX']);
					let roundedValMax = (Math.round(maxVal * 10)/10).toFixed(1);
					thisAgg[thisLayout.id + 'AVG'] = roundedValAvg;
					thisAgg[thisLayout.id + 'MAX'] = roundedValMax;
				}
			}
			if(rankMap[thisAgg._id]){
				thisAgg['rank'] = rankMap[thisAgg._id].rank;
				aggArray[aggIdx] = thisAgg;
			}
		}
		//quick sort by rank
		aggArray.sort((a: { rank: number; }, b: { rank: number; }) => {
			let aNum = a.rank;
			let bNum = b.rank;
			if( aNum < bNum ){
				return -1;
			}
			if( aNum > bNum ){
				return 1;
			}
			return 0;
		});
		
		let sortedTeams: Array<{rank: number, team_key: TeamKey}> = [];
		for(let i = numAlliances; i < rankings.length; i++){
			sortedTeams[i - numAlliances] = {
				rank: rankings[i].rank,
				team_key: rankings[i].team_key
			};
		}
		sortedTeams.sort((a, b) => {
			if(a && b){
				let aNum = parseInt(a.team_key.substring(3));
				let bNum = parseInt(b.team_key.substring(3));
				if ( aNum < bNum )
					return -1;
				if ( aNum > bNum )
					return 1;
				else 
					return 0;
			}
			else
				return 1;
		});
		
		logger.trace(sortedTeams);
	
		// read in the current agg ranges
		// 2020-02-08, M.O'C: Tweaking agg ranges
		let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': org_key, 'event_key': event_key});
	
		//logger.debug('aggArray=' + JSON.stringify(aggArray));
		res.render('./dashboard/allianceselection', {
			title: res.msg('allianceselection.title'),
			rankings: rankings,
			alliances,
			numAlliances,
			numRounds,
			aggdata: aggArray,
			currentAggRanges,
			layout: scoreLayout,
			sortedTeams,
			matchcountConsistent,
			matchDataHelper,
			picklist_key,
			orgTeamKeys: req._user.org.team_keys,
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
	let loadPhotos = req.query.loadPhotos;

	// for later querying by event_key
	let event_year = req.event.year;
	let event_key = req.event.key;
	let org_key = req._user.org_key;

	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	let teamAssignments: PitScouting[] = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key}, { }); 
		
	//sort teams list by number
	teamAssignments.sort(function(a, b) {
		let aNum = parseInt(a.team_key.substring(3));
		let bNum = parseInt(b.team_key.substring(3));
		return aNum - bNum;
	});
	
	// read in team list for data
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	let thisEvent: Event = await utilities.findOne('events', 
		{'key': event_key}, {},
		{allowCache: true}
	);
	let teamArray: Team[] = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0) {

		logger.debug('thisEvent.team_keys=' + JSON.stringify(thisEvent.team_keys));
		teamArray = await utilities.find('teams', 
			{'key': {$in: thisEvent.team_keys}}, {sort: {team_number: 1}},
			{allowCache: true}
		);
	}

	// Build map of team_key -> team data
	let teamKeyMap: Dict<Team> = {};
	for (let teamIdx = 0; teamIdx < teamArray.length; teamIdx++) {
		//logger.debug('teamIdx=' + teamIdx + ', teamArray[]=' + JSON.stringify(teamArray[teamIdx]));
		teamKeyMap[teamArray[teamIdx].key] = teamArray[teamIdx];
	}

	// 2023-03-30, M.O'C: Adding guardrail around 'teams were updated (some removed) after pit scouting was assigned'
	let allTeamsInDB = true;
	// Add data to 'teams' data
	for (let teamIdx = 0; teamIdx < teamAssignments.length; teamIdx++) {
		// logger.debug('teams[teamIdx]=' + JSON.stringify(teams[teamIdx]) + ', teamKeyMap[teams[teamIdx].team_key]=' + JSON.stringify(teamKeyMap[teams[teamIdx].team_key]));
		if (!teamKeyMap[teamAssignments[teamIdx].team_key]) {
			allTeamsInDB = false;
			break;
		}
		// 2022-05-18 JL: Passing teamKeyMap to view instead of adding nickname to the teamAssignments object
		//	we can still use this loop to guarantee that the pug won't encounter an error
		// teamAssignments[teamIdx].nickname = teamKeyMap[teams[teamIdx].team_key].nickname;
	}
	//Add a call to the database for populating menus in pit scouting
	let teamKeys = [];
	for (let team of teamArray) {
		if (team.hasOwnProperty('key')) teamKeys.push(team.key);
	}
	
	let images;
	
	if (loadPhotos) {
		images = await uploadHelper.findTeamImagesMultiple(org_key, event_year, teamKeys);
	}
	
	res.render('./dashboard/pits', {
		title: res.msg('scouting.pit'),
		teamAssignments: teamAssignments,
		teamKeyMap: teamKeyMap,
		images: images,
		allTeamsInDB: allTeamsInDB
	});	
}));

router.get('/matches', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[get]');
	logger.info('ENTER');

	// for later querying by event_key
	let eventKey = req.event.key;
	let org_key = req._user.org_key;

	logger.info('ENTER org_key=' + org_key + ',eventKey=' + eventKey);

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	// 2024-01-27, M.O'C: Switch to *max* time of *resolved* matches [where alliance scores != -1]
	let matches: Match[] = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': {$ne: -1} },{sort: {'time': -1}});
	// 2024-04-04, M.O'C: Also get the *unresolved* matches (for 'comp_level')
	let unresolvedMatches: Match[] = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': {$eq: -1} },{sort: {'time': -1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	// 2024-02-06, M.O'C: Have to change 'latestTimestamp' to be *early* UNLESS matches have been played
	let latestTimestamp = 1234;
	if (matches && matches[0]) {
		let latestMatch = matches[0];
		latestTimestamp = latestMatch.time + 1;
	}
	
	// 2018-04-05, M.O'C - Adding 'predicted time' to a map for later enriching of 'scoreData' results
	let matchLookup: Dict<Match> = {};
	if (matches)
		for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
			//logger.debug('associating ' + matches[matchIdx].predicted_time + ' with ' + matches[matchIdx].key);
			//logger.debug(`matches[matchIdx].key=${matches[matchIdx].key}`);
			matchLookup[matches[matchIdx].key] = matches[matchIdx];
		}
	// 2024-04-04, M.O'C - Also build a map of *unresolved* matches
	let unresolvedMatchLookup: Dict<Match> = {};
	if (unresolvedMatches)
		for (let matchIdx = 0; matchIdx < unresolvedMatches.length; matchIdx++) {
			//logger.debug(`matches[matchIdx].key=${unresolvedMatches[matchIdx].key}`);
			unresolvedMatchLookup[unresolvedMatches[matchIdx].key] = unresolvedMatches[matchIdx];
		}

	logger.debug('latestTimestamp=' + latestTimestamp);

	// Get all the UNRESOLVED matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	// 2022-03-17 JL: Reversed alliance sorting order to show red first
	let scoreData: (MatchScouting & {comp_level?: string, set_number?: number})[] = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $gte: latestTimestamp }}, { limit: 90, sort: {'time': 1, 'alliance': -1, 'team_key': 1} });

	if(!scoreData)
		return logger.error('mongo error at dashboard/matches');

	logger.debug('scoreData.length=' + scoreData.length);

	// M.O'C, 2023-03-29: Are there "future" resolved matches?
	let futureMatchResultsConsistent = true;
	// Get matches at or beyond the 'earliest' time
	let futureMatches: Match[] = await utilities.find('matches', { event_key: eventKey, 'time': { $gte: latestTimestamp }},{sort: {'time': 1}});
	for (let futureIdx = 0; futureIdx < futureMatches.length; futureIdx++) {
		logger.trace(`future IDX: ${futureIdx} - time: ${futureMatches[futureIdx].time} - red score: ${futureMatches[futureIdx].alliances.red.score}`);
		if (futureMatches[futureIdx].alliances.red.score != -1) {
			futureMatchResultsConsistent = false;
			break;
		}
	}

	for (let scoreIdx = 0; scoreIdx < scoreData.length; scoreIdx++) {
		//logger.debug('getting for ' + scoreData[scoreIdx].match_key);
		if (scoreData[scoreIdx] && matchLookup[scoreData[scoreIdx].match_key]) {
			// @ts-ignore - JL note: don't wanna bother with this rn
			scoreData[scoreIdx].predicted_time = matchLookup[scoreData[scoreIdx].match_key].predicted_time;
		}
	}
	
	logger.trace('DEBUG getting nicknames next?');

	// read in team list for data
	let teamArray = req.teams; // 2022-03-13 JL: Removed copied code for identifying the current event & teams
	
	if (!teamArray) throw new e.InternalServerError(res.msg('errors.eventTeamsMissing'));
	
	// Build map of team_key -> team data
	let teamKeyMap: Dict<Team> = {};
	for (let teamIdx = 0; teamIdx < teamArray.length; teamIdx++) {
		//logger.debug('teamIdx=' + teamIdx + ', teamArray[]=' + JSON.stringify(teamArray[teamIdx]));
		teamKeyMap[teamArray[teamIdx].key] = teamArray[teamIdx];
	}
	
	for(let i in scoreData) {
		if (teamKeyMap[scoreData[i].team_key]) {
			// @ts-ignore - JL note: don't wanna bother with this rn
			scoreData[i].team_nickname = teamKeyMap[scoreData[i].team_key].nickname;
		}
		else {
			// @ts-ignore - JL note: don't wanna bother with this rn
			scoreData[i].team_nickname = res.msg('dashboard.none');
		}
		// 2024-04-04, M.O'C: While we're here... also pass up the 'comp_level' of the match
		if (scoreData[i].match_key && unresolvedMatchLookup[scoreData[i].match_key]) {
			scoreData[i].comp_level = unresolvedMatchLookup[scoreData[i].match_key].comp_level;
			scoreData[i].set_number = unresolvedMatchLookup[scoreData[i].match_key].set_number;
			//logger.debug(`comp_level=${scoreData[i].comp_level}`);
		}
		else {
			logger.debug(`scoreData[i].match_key=${scoreData[i].match_key} & ${(scoreData[i].match_key ? unresolvedMatchLookup[scoreData[i].match_key] : '(nvrmind)')}`);
		}
	}
	//this line has a definition problem ^
	logger.debug('scoreData.length=' + scoreData.length);
	res.render('./dashboard/matches',{
		title: res.msg('scouting.match'),
		matches: scoreData,
		futureMatchResultsConsistent: futureMatchResultsConsistent
	});
}));

module.exports = router;

interface ChartJSData {
	datasets: {
		avg: AllianceDataSet;
		max: AllianceDataSet;
		sum: AllianceDataSet;
	};
	items: {
		blue: ChartJSItem[];
		red: ChartJSItem[];
	}
	labels: string[][];
	options: unknown;
}

interface AllianceDataSet {
	blue: [
		number[],
		number[],
		number[]
	];
	red: [
		number[],
		number[],
		number[]
	]
}

interface ChartJSItem {
	label: string;
	backgroundColor: string;
	borderColor: string;
}