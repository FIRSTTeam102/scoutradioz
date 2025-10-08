import express from 'express';
import { getLogger } from 'log4js';
import type Mathjs from 'mathjs';
import wrap from '../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import type { AnyDict, Match, MatchFormData, Event, Org, EventOrgScouting, EventScouting, EventScoutingSummary, Supporter } from 'scoutradioz-types';
import e from 'scoutradioz-http-errors';
const mathjs: Mathjs.MathJsStatic = require('mathjs');

const router = express.Router();
const logger = getLogger('index');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

// April fools 20224
router.get('/try-video-scouting', wrap(async (req, res) => {
	res.render('./aprilfools', {
		title: 'Generative AI Scouting',
		disableAIthing: true,
	});
}));

/**
 * The "index" page that loads is now a form to select an organization.
 */
router.get('/', wrap(async (req, res, next) => {
	logger.addContext('funcName', 'root[get]');
	logger.debug('ENTER');
	
	//If there is a logged-in user, that means they HAVE selected an org, and 
	// so then redirect to /home
	//If user has not selected an org (not logged in), send them to pick-org page.
	if( req.user ){
		
		//added originalUrl to make GET queries to persist (for alert)
		res.redirect(307, '/home' + req.originalUrl);
	}
	else if ( req.query.org_key || req.cookies.org_key ){
		//Prioritize QUERY org key over cookies
		//If someone wishes to share a page in the future, the link will include org_key
		let orgKey = req.query.org_key || req.cookies.org_key;
		
		//redirect to selectorg with the selected org_key to sign in to the org user
		res.redirect(307, `/selectorg?org_key=${orgKey}&redirectURL=${req.originalUrl}`);
	}
	else{
		
		// 2022-02-19 JL: Replaced all that timely/expensive eventMap stuff with a single aggregate call
		const aggPipeline = [
			{$sort: {team_number: 1, org_key: 1}},
			{$lookup: {
				from: 'events',
				localField: 'event_key',
				foreignField: 'key',
				as: 'event'
			}},
			{$set: {
				event_label: {$concat: [
					{ $toString: { $arrayElemAt: ['$event.year', 0]}},
					' ',
					{ $arrayElemAt: ['$event.name', 0]},
				]} 
			}},
			{$project: {
				event: 0
			}}
		];
		
		const orgs = await utilities.aggregate('orgs', aggPipeline, {allowCache: true});
		
		const selectedButton = req.query['customer'] || req.cookies['homepageButton']; // Previously-selected "Are you:" button on the homepage
		
		res.render('./index', {
			fulltitle: res.msg('index.fulltitle'),
			orgs: orgs,
			redirectURL: req.getFixedRedirectURL(), //redirectURL for viewer-accessible pages that need an organization to be picked before it can be accessed
			isOrgSelectScreen: true,
			selectedButton: selectedButton
		});
	}
}));

/**
 * Browse by event
 */
router.get('/browse', wrap(async (req, res, next) => {
	logger.addContext('funcName', 'browse[get]');
	logger.debug('ENTER');
	
	// for now, this only works with the current year. TODO: be able to browse past years
	let current_year = (new Date()).getFullYear();

	// 2025-04-14, M.O'C: Further enforce not recalculating cached data older than N days ago
	let right_now = new Date();
	let lookback_days = 7;
	if (req.query.lookback_days)
		lookback_days = parseInt(req.query.lookback_days as string);
	let lookback_date = new Date(right_now.getTime() - (lookback_days * 24 * 60 * 60 * 1000));
	// get as a string "YYYY-MM-DD"
	let lookback_string = lookback_date.toISOString().split('T')[0];

	// 2025-03-13, M.O'C: Implement caching of event scouting summary; refresh every 15 minutes
	// check the database for the cached data
	let eventScoutingSummary: EventScoutingSummary[] = await utilities.find('eventscoutingsummary', {
		year: current_year
	},{
		sort: {'writeTime': -1}
	});
	// if there is data AND the data is less than 15 minutes old, use it
	let eventOrgDict: { [id: string]: EventScouting } = {};
	if (eventScoutingSummary.length > 0) {
		let thisSummary = eventScoutingSummary[0];
		let now = Date.now();

		// 2025-04-14
		if (req.query.forceRefresh == 'true') {
			logger.warn('Forcing a refresh!');
		}
		else if (now - thisSummary.writeTime < 900000 || req.query.forceRefresh == 'true') { // 15 minutes
			let delta = (now - thisSummary.writeTime) / 1000.0;
			logger.debug(`Using cached event scouting summary for year ${current_year} - delta=${delta} seconds, now=${now} epoch`);

			res.render('./browse', {
				fulltitle: res.msg('index.browse.title'),
				year: current_year,
				event_scouting: thisSummary.events
			});
			return;
		}

		// otherwise copy the existing data into a dictionary for later use
		if (thisSummary.events)
			for (let i = 0; i < thisSummary.events.length; i++)
				if (thisSummary.events[i])
					eventOrgDict[thisSummary.events[i].eventKey] = thisSummary.events[i];
	}
	// 2025-03-13, M.O'C: otherwise... regenerate!

	// 
	// Get the latest match played timestamp per year
	//
	let latest_match_time_per_year = [
		{
			$match: {
				'actual_time': { $exists: true }, // Ensure "actual_time" field exists
				'alliances.red.score': { $ne: -1},
				'comp_level': 'qm'
				//"year": { $in: [2023, 2024] } // Match documents for the specified years
			}
		},
		{
			$group: {
				_id: '$year', // Group by year
				max_actual_time: { $max: '$actual_time' } // Find the maximum value of "actual_time" for each year
			}
		}
	];
	let match_latest = await utilities.aggregate('matches', latest_match_time_per_year, {allowCache: true, maxCacheAge: 300});
	logger.debug(`match_latest=${JSON.stringify(match_latest)}`);

	// get counts of match scouting entries per event, per org
	let events_and_orgs_agg = [
		{
			$match: { 'year': current_year, 'data': {$ne: null} }
		},
		{
			$group: {
				_id: { event_key: '$event_key', org_key: '$org_key' },
				count: { $sum: 1 }
			}
		},
		{
			$sort: { '_id.event_key': 1, '_id.org_key': 1 }
		}
	];
	let event_orgs = await utilities.aggregate('matchscouting', events_and_orgs_agg, {allowCache: true, maxCacheAge: 300});
	logger.debug(`event_orgs = ${JSON.stringify(event_orgs)}`);

	let eventDict: { [id: string]: string } = {};
	let eventToOrgsDict: { [id: string]: string[] } = {};
	let eventOrgCountDict: { [id: string]: number } = {};
	// build list of unique events, and map of event:[list of teams]
	for (let i = 0; i < event_orgs.length; i++) {
		let thisElem = event_orgs[i]._id;
		let thisEvent = thisElem.event_key;
		let thisOrg = thisElem.org_key;

		eventDict[thisEvent] = thisEvent;
		let checkEvent = eventToOrgsDict[thisEvent];
		if (checkEvent) {
			checkEvent.push(thisOrg);
			eventToOrgsDict[thisEvent] = checkEvent;
		}
		else {
			let newEventList: string[] = [];
			newEventList.push(thisOrg);
			eventToOrgsDict[thisEvent] = newEventList;
		}

		let eventOrgKey = thisEvent + '|' + thisOrg;
		eventOrgCountDict[eventOrgKey] = event_orgs[i].count;
	}
	let eventList = Object.keys(eventDict);
	logger.debug(`eventList = ${JSON.stringify(eventList)}`);
	logger.debug(`eventToOrgsDict = ${JSON.stringify(eventToOrgsDict)}`);

	// get info for events
	let events: Event[] = await utilities.find('events', 
		{'year': current_year, 'key': { '$in': eventList }},
		{sort: {start_date: -1}},
		{allowCache: true, maxCacheAge: 300}
	);
	let eventInfoDict: { [id: string]: Event } = {};
	for (let thisIdx in events)
		eventInfoDict[events[thisIdx].key] = events[thisIdx];

	// get info for orgs
	let orgs: Org[] = await utilities.find('orgs', {}, {}, {allowCache: true, maxCacheAge: 300});
	let orgInfoDict: { [id: string]: Org } = {};
	for (let thisIdx in orgs)
		orgInfoDict[orgs[thisIdx].org_key] = orgs[thisIdx];

	// get counts of completed matches per event
	let count_of_matches_by_event = [
		{
			$match: {
				'event_key': { $in: eventList },
				'alliances.red.score': { $ne: -1},
				'comp_level': 'qm'
			}
		},
		{
			$group: {
				_id: '$event_key',
				total_matches: { $sum: 1 }
			}
		},
		{
			$project: {
				_id: 0,
				event_key: '$_id',
				total_matches: 1
			}
		},
		{
			$sort: {
				'event_key': 1
			}
		}
	];
	let matches_by_event = await utilities.aggregate('matches', count_of_matches_by_event, {allowCache: true, maxCacheAge: 300});
	logger.debug(`matches_by_event = ${JSON.stringify(matches_by_event)}`);
	let eventMatchCountDict: { [id: string]: number } = {};
	for (let eventIdx = 0; eventIdx < matches_by_event.length; eventIdx++) {
		let this_match_event = matches_by_event[eventIdx];
		eventMatchCountDict[this_match_event.event_key] = this_match_event.total_matches;
	}

	let eventScoutingArray: EventScouting[] = [];
	// Loop through each event
	for (let eventIdx = 0; eventIdx < eventList.length; eventIdx++) {
		let thisEventKey = eventList[eventIdx];

		// 2025-04-14, M.O'C: If the event started before the 'lookback_date', just use the cached value
		if (eventInfoDict[thisEventKey] && eventInfoDict[thisEventKey].start_date < lookback_string) {
			let existingEventOrgScouting = eventOrgDict[thisEventKey];
			logger.debug(`for event ${thisEventKey}, ${eventInfoDict[thisEventKey].start_date} is before ${lookback_string} - using existingEventOrgScouting=${JSON.stringify(existingEventOrgScouting)}`);
			eventScoutingArray.push(existingEventOrgScouting);
		}
		// otherwise, compute
		else {
			let thisEventOrgs = eventToOrgsDict[thisEventKey];

			// get the matches for this event
			let matches: Match[] = await utilities.find('matches',
				{ 'event_key': thisEventKey, 'comp_level': 'qm', 'score_breakdown': { '$ne': undefined }, 'alliances.red.score': {$ne: -1} }, { sort: { match_number: 1 } },
				{allowCache: true, maxCacheAge: 300}
			);
			let matchDict: { [id: string]: Match } = {};
			let debugFirstMatch = true;
			for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
				if (debugFirstMatch) {
					logger.trace(`matchIdx=${matchIdx}, matches[matchIdx]=${JSON.stringify(matches[matchIdx])}`);
					debugFirstMatch = false;
				}
				//logger.debug(`matches[matchIdx].key=${matches[matchIdx].key}`);
				matchDict[matches[matchIdx].key] = matches[matchIdx];
			}

			// Set event-level evaluation - possible # of match scouting reports (and) initial "eventMinSpr"
			let thisEventMatchCount = matches.length * 6;
			logger.debug(`### AT ${thisEventKey}: ${JSON.stringify(thisEventOrgs)} ~ has ${thisEventMatchCount} possible match reports`);
			// Use some arbitrarily high number to start the 'event minimum SPR' with
			const ARBITRARILY_HIGH_SPR = 99999.9;		
			let thisEventMinSpr = ARBITRARILY_HIGH_SPR;
			// Keep track of teams with TSPS-possible data at the event
			let tspsPossibleDataCount = 0;
			// Array for storing org scouting info
			let thisEventOrgScoutingArray: EventOrgScouting[] = [];

			// Loop through each team at this event
			for (let teamIdx = 0; teamIdx < thisEventOrgs.length; teamIdx++) {
				let thisOrgKey = thisEventOrgs[teamIdx];
				logger.debug(`-- Org ${thisOrgKey}:`);

				// track values per org: orgKey, numReports, medianSpr, minSpr, tsps
				let thisNumReports = eventOrgCountDict[thisEventKey + '|' + thisOrgKey];
				let thisMedianSpr: number = NaN;
				let thisMinSpr: number = NaN;

				let cp_per_match_per_alliance = [
					{
						$match: {
							'event_key': thisEventKey,
							'org_key': thisOrgKey,
							'data': {'$ne': undefined}
						}
					},
					{
						$group: {
							_id: {
								match_key: '$match_key',
								alliance: '$alliance'
							},
							count: { $sum: 1 },
							total_contributed_points: { $sum: '$data.contributedPoints' },
							actual_scorer_names: { $push: '$actual_scorer.name' },
							actual_scorer_ids: { $push: '$actual_scorer.id' }
						}
					},
					{
						$project: {
							_id: 0,
							match_key: '$_id.match_key',
							alliance: '$_id.alliance',
							count: 1,
							total_contributed_points: 1,
							actual_scorer_names: 1,
							actual_scorer_ids: 1
						}
					},
					{
						$sort: {
							'match_key': 1,
							'alliance': 1
						}
					}
				];

				let cpPerMatchPerAlliance = await utilities.aggregate('matchscouting', cp_per_match_per_alliance, {allowCache: true, maxCacheAge: 300});
				//logger.debug(`event=${thisEventKey}~org=${thisOrgKey}: ${JSON.stringify(cpPerMatchPerAlliance)}`);

				//
				// Calculate SPRs & find the median
				//

				// dictionary of scouts - each item should be keyed by scout name and contain (a) total matches scouted + (b) total error point diffs & ratios	
				let scoutScoreDict: Dict<{count: number, avgDiff: number, avgRatio: number, totDiff: number, totRatio: number, sprIndex: number, sprScore: number}> = {};

				// SPR arrays setup
				let scoutSprList:string[] = [];
				let emptyRow:number[] = [];
				let matrix:number[][] = [];
				let vector:number[][] = [];

				let debugFirstMatch = true;
				for (let cppmpaIdx = 0; cppmpaIdx < cpPerMatchPerAlliance.length; cppmpaIdx++) {
					let thisCppmpa = cpPerMatchPerAlliance[cppmpaIdx];
					if (thisCppmpa.count === 3) {
						if (debugFirstMatch) {
							logger.trace(`thisCppmpa=${JSON.stringify(thisCppmpa)}`);
							debugFirstMatch = false;
						}

						let thisMatchKey = thisCppmpa.match_key;
						let thisAlliance: 'red'|'blue' = thisCppmpa.alliance;

						let thisMatch = matchDict[thisMatchKey];
						if (!thisMatch) {
							logger.warn(`No match found for thisMatchKey=${thisMatchKey}`);
						}
						else {
							let thisScoreBreakdown = thisMatch.score_breakdown[thisAlliance];
							let totalPoints = getNumberFrom(thisScoreBreakdown, 'totalPoints');
							let foulPoints = getNumberFrom(thisScoreBreakdown, 'foulPoints');
							let frcTot = totalPoints - foulPoints;
		
							let orgTot = thisCppmpa.total_contributed_points;

							let errDiff = Math.abs(orgTot - frcTot);
							let errRatio = errDiff / frcTot;
							if (errRatio > 1.0)
								errRatio = 1.0;

							logger.trace(`Match found for thisMatchKey=${thisMatchKey}: frcTot=${frcTot}, orgTot=${orgTot}`);

							for (let scoutIdx = 0; scoutIdx < 3; scoutIdx++ ) {
								let thisScoutId = thisCppmpa.actual_scorer_ids[scoutIdx];
								let thisScoutName = thisCppmpa.actual_scorer_names[scoutIdx];
								let thisScoutRecord = scoutScoreDict[thisScoutId];
								if (!thisScoutRecord) {
									// add rows & cols to matrix, and add an element to the vector
									let thisScoutIndex = vector.length;
									vector.push([0]);
									logger.trace(`thisScoutName=${thisScoutName},thisScoutId=${thisScoutId},thisScoutIndex=${thisScoutIndex}`);
									scoutSprList.push(thisScoutName);
			
									emptyRow = [];
									for (let i = 0; i < matrix.length; i++) {
										emptyRow.push(0);
										matrix[i].push(0);
									}
									emptyRow.push(0);
									matrix.push(emptyRow);
									//logger.debug(`ADD vector=${JSON.stringify(vector)}`);
									//logger.debug(`ADD matrix=${JSON.stringify(matrix)}`);
			
									scoutScoreDict[thisScoutId] = {count: 1, avgDiff: errDiff, avgRatio: errRatio, totDiff: errDiff, totRatio: errRatio, sprIndex: thisScoutIndex, sprScore: 0};
								}
								else {
									logger.trace(`updating ${JSON.stringify(thisScoutRecord)}`);
									let newCount = thisScoutRecord.count + 1;
									let newTotDiff = thisScoutRecord.totDiff + errDiff;
									let avgDiff = newTotDiff / newCount;
									let newTotRatio = thisScoutRecord.totRatio + errRatio;
									let avgRatio = newTotRatio / newCount;
									scoutScoreDict[thisScoutId] = {count: newCount, avgDiff: avgDiff, avgRatio: avgRatio, totDiff: newTotDiff, totRatio: newTotRatio, sprIndex: thisScoutRecord.sprIndex, sprScore: 0};
								}
							}

							// SPR matrix & vector updates
							for (let x = 0; x < thisCppmpa.actual_scorer_ids.length; x++) {
								let thisScout = thisCppmpa.actual_scorer_ids[x];
								if (!thisScout) {
									logger.debug('No actual_scorer for scout report idx=' + x);
									continue;
								}
								// 2022-02-20 JL: renamed thisScoutName to thisScout, added thisScoutId
								let thisScoutId = thisCppmpa.actual_scorer_ids[x];
								let thisScoutName = thisCppmpa.actual_scorer_names[x];
								// let thisScoutName = thisScout.name;
								
								let xIndex = scoutScoreDict[thisScoutId].sprIndex;
								vector[xIndex][0] = vector[xIndex][0] + errDiff;
								for (let y = 0; y < thisCppmpa.actual_scorer_ids.length; y++) {
									let thisScout2 = thisCppmpa.actual_scorer_ids[y];
									if (!thisScout2) {
										logger.trace('No actual_scorer 2 for scout report idx=' + y);
										continue;
									}
									let thisScoutId2 = thisCppmpa.actual_scorer_ids[y];
									let thisScoutName2 = thisCppmpa.actual_scorer_names[x];
									
									let yIndex = scoutScoreDict[thisScoutId2].sprIndex;
									logger.trace(`scout1=${thisScoutName},scout2=${thisScoutName2},xIndex=${xIndex},yIndex=${yIndex}`);

									matrix[yIndex][xIndex] = matrix[yIndex][xIndex] + 1;
								}
							}
						}
					}
				}

				// what is the determinant?
				logger.trace(`matrix=${JSON.stringify(matrix)}`);
				if (matrix.length > 0)
					logger.trace(`...math.det(matrix)=${mathjs.det(matrix)}`);
				else
					logger.trace('...math.det(matrix)=matrix_is_zero_size');
				logger.trace(`vector=${JSON.stringify(vector)}`);

				// solve!
				try {
					let solution = mathjs.lusolve(matrix, vector) as Mathjs.MathNumericType[][];
					logger.trace(`solution=${JSON.stringify(solution)}`);

					for (let key in scoutScoreDict) {
						let thisSprIndex:number = scoutScoreDict[key].sprIndex;
						scoutScoreDict[key].sprScore = Number(solution[thisSprIndex][0]);
					}
				}
				catch (err) {
					logger.warn(`could not calculate solution! err=${err}`);
				}
							
				// sort scoutScoreDict by sprScore
				let sortedValues:Array<{count: number, avgDiff: number, avgRatio: number, totDiff: number, totRatio: number, sprIndex: number, sprScore: number}> = Object.values(scoutScoreDict);
				// reverse sort!
				sortedValues.sort((a, b) => a.sprScore - b.sprScore);
				logger.trace('sortedValues=' + JSON.stringify(sortedValues));

				// // reconstruct scoutScoreDict
				// scoutScoreDict = {};
				// for (let thisIdx in sortedValues) {
				// 	//logger.trace(`thisIdx=${thisIdx}`);
				// 	let thisValue = sortedValues[thisIdx];
				// 	logger.trace(`thisValue=${thisValue}`);
				// 	logger.trace(`thisValue.sprIndex=${thisValue.sprIndex}`);
				// 	logger.trace(`scoutSprList[thisValue.sprIndex]=${scoutSprList[thisValue.sprIndex]}`);
				// 	scoutScoreDict[scoutSprList[thisValue.sprIndex]] = thisValue;
				// }
				// // final results
				// logger.trace('scoutScoreDict=' + JSON.stringify(scoutScoreDict));

				let sprLength = sortedValues.length;
				if (sprLength > 0) {
					thisMinSpr = sortedValues[0].sprScore;
					if (thisMinSpr < thisEventMinSpr)
						thisEventMinSpr = thisMinSpr;

					thisMedianSpr = 0.0;
					// do we have an odd number of items?
					if (sprLength & 1) {
						thisMedianSpr = sortedValues[Math.trunc(sprLength/2.0)].sprScore; 
						logger.trace(`thisNumReports=${thisNumReports} ~ thisMinSpr=${thisMinSpr} ~ sprLength ${sprLength} is odd, thisMedianSpr=${thisMedianSpr}`);
					}
					else {
						thisMedianSpr = (sortedValues[Math.trunc(sprLength/2.0) - 1].sprScore + sortedValues[Math.trunc(sprLength/2.0)].sprScore) / 2.0;
						logger.trace(`thisNumReports=${thisNumReports} ~ thisMinSpr=${thisMinSpr} ~ sprLength ${sprLength} is even, thisMedianSpr=${thisMedianSpr}`);
					}
				}

				let thisIsTspsElgibile: boolean = false; 
				// do we have TSPS-possible data?
				if (!isNaN(thisMinSpr) && !isNaN(thisMedianSpr) && !(thisMinSpr === 0.0 && thisMedianSpr === 0.0)) {
					logger.trace('Has TSPS possible!');
					thisIsTspsElgibile = true;
					tspsPossibleDataCount += 1;
				}
				else {
					logger.warn('Not TSPS possible data');
				}

				let thisEventOrgScouting: EventOrgScouting = { 
					countScoutingReports: thisNumReports,
					orgKey: thisOrgKey,
					orgName: orgInfoDict[thisOrgKey].nickname,
					isTspsEligible: thisIsTspsElgibile
				};
				if (thisIsTspsElgibile) {
					thisEventOrgScouting.medianSpr = thisMedianSpr;
					thisEventOrgScouting.minSpr = thisMinSpr;
				}

				thisEventOrgScoutingArray.push(thisEventOrgScouting);
			}

			// calculate Total Scouting Performance Scores **IF** there are at least 2 orgs with valid data
			logger.trace(`thisEventMinSpr=${thisEventMinSpr}, tspsPossibleDataCount=${tspsPossibleDataCount}`);
			if (tspsPossibleDataCount > 1) {
				// normalization value
				let thisSprNormalization = Math.abs(thisEventMinSpr);

				// find the 'best' normalized SPR
				let thisBestSpr = ARBITRARILY_HIGH_SPR;
				for (let thisTspsIdx in thisEventOrgScoutingArray) {
					let thisScoutingBlob = thisEventOrgScoutingArray[thisTspsIdx];
					if (thisScoutingBlob.isTspsEligible && typeof(thisScoutingBlob.medianSpr) == 'number' && thisScoutingBlob.medianSpr < thisBestSpr)
						thisBestSpr = thisScoutingBlob.medianSpr;
				}

				// calculate TSPS
				// thisEventMatchCount is total possible scouting reports
				for (let thisTspsIdx in thisEventOrgScoutingArray) {
					let thisScoutingBlob = thisEventOrgScoutingArray[thisTspsIdx];
					if (thisScoutingBlob.isTspsEligible && typeof(thisScoutingBlob.medianSpr) == 'number') {
						let sprComponent = (thisBestSpr + thisSprNormalization) / (thisScoutingBlob.medianSpr + thisSprNormalization);
						let thisMatchCount = thisScoutingBlob.countScoutingReports;
						if (typeof(thisMatchCount) == 'number' && thisMatchCount > thisEventMatchCount) {
							logger.warn(`for org=${thisScoutingBlob.orgKey} at event=${thisEventKey}, org match count ${thisMatchCount} > event match count ${thisEventMatchCount}`);
							thisMatchCount = thisEventMatchCount;
						}
						let coverageComponent = thisMatchCount / thisEventMatchCount;
						// Total Scouting Performance Score!
						let thisTsps = (sprComponent + coverageComponent) / 2.0;
						thisScoutingBlob.tsps = thisTsps;					
					}
				}
			}

			let thisEventScouting: EventScouting = {
				eventKey: thisEventKey, 
				eventName: eventInfoDict[thisEventKey].name,
				eventStart: eventInfoDict[thisEventKey].start_date,
				possibleScoutingReports: thisEventMatchCount,
				orgData: thisEventOrgScoutingArray
			};
			logger.debug(`thisEventScouting=${JSON.stringify(thisEventScouting)}`);
			eventScoutingArray.push(thisEventScouting);
		}
	}

	// sort the array by date
	eventScoutingArray.sort((a, b) => (a.eventStart < b.eventStart ? 1 : -1));

	// delete the previous event scouting summary
	await utilities.remove('eventscoutingsummary', {year: current_year});
	// save the event scouting summary
	let eventScoutingSummaryDoc: EventScoutingSummary = {
		year: current_year,
		events: eventScoutingArray,
		writeTime: Date.now()
	};
	await utilities.insert('eventscoutingsummary', eventScoutingSummaryDoc);

	res.render('./browse', {
		fulltitle: res.msg('index.browse.title'),
		year: current_year,
		event_scouting: eventScoutingArray
	});
}));

/**
 * User submission to select an organization.
 */
router.all('/selectorg', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'selectorg[all]');
	logger.debug('ENTER');
	
	doSelectOrg(req, res, () => {
		//now, once default user is logged in, redirect to index
		logger.debug('User is now in an org, redirecting');
		
		let redirectURL = req.getRedirectURL();
		
		if (redirectURL) {
			logger.debug(`redirect: ${redirectURL}`);
			if (req.query.alert) {
				// 2022-04-05 JL: Introduced getURLWithQueryParameters so we don't have to worry about ? and & all the time
				redirectURL = req.getURLWithQueryParameters(redirectURL, {alert: req.query.alert});
				// 2022-02-27 JL: fixing alert not showing up on login redirects
				// if (redirectURL.includes('?')) redirectURL += '&alert=' + req.query.alert;
				// else redirectURL += '?alert=' + req.query.alert;
			}
			res.redirect(redirectURL);
		}
		else {
			res.redirect('/home');
		}
	});
}));

router.all('/selectorg-login', wrap(async (req, res) => {
	//http://localhost:3000/?redirectURL=/scouting/pit%3fteam_key=frc58%26foo=bar
	
	logger.addContext('funcName', 'selectorg[all]');
	logger.debug('ENTER');
	
	doSelectOrg(req, res, () => {
		logger.debug('User is now in an org, taking them to the login page');
		
		let redirect = req.getFixedRedirectURL();
		res.redirect(`/user/login?rdr=${redirect}`);
	});
}));

/**
 * Main homepage.
 * @url /
 * @view /index
 */
router.get('/home', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'home[get]');
	logger.debug('ENTER');
	
	let redirect = req.getRedirectURL();
	if (redirect) {
			
		logger.debug(`redirect: ${redirect}`);
		res.redirect(redirect);
	}
	else if (!req.user) res.redirect('/');
	else {
		res.render('./home', { 
			title: res.msg('home.title'),
		});
	}
}));

/**
 * Thank-you page
 * @url /thankyou
 * @view /thankyou
 */
router.get('/thankyou', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'thankyou[get]');
	logger.debug('ENTER');
	
	let donors: Supporter[] = await utilities.find('supporters', {
		type: 'donor'
	},{
		sort: {'writeTime': -1}
	});
	//logger.debug(`donors=${JSON.stringify(donors)}`);

	let sponsors: Supporter[] = await utilities.find('supporters', {
		type: 'sponsor'
	},{
		sort: {'writeTime': -1}
	});

	res.render('./thankyou', {
		donors: donors, 
		sponsors: sponsors,
		title: res.msg('thankyou.title'),
	});
}));

router.get('/throwanerror', wrap(async (req, res) => {
	logger.addContext('funcName', 'throwanerror[get]');
	
	throw new e.InternalServerError('This was on purpose.');
	
}));

router.get('/usererror', wrap(async (req, res) => {
	logger.addContext('funcName', 'usererror[get]');
	
	throw new e.UserError();
}));

// Moved the select-org process into a helper function so I can do it with the standard selectorg and & one which immediately takes you to the login screen
async function doSelectOrg(req: express.Request, res: express.Response, cb: () => void) {
	
	let org_key = req.body.org_key || req.query.org_key;
	logger.debug(`org_key=${org_key}`);
	
	//Make sure that form is filled
	if(!org_key || org_key == ''){
		logger.debug('Form isn\'t filled, redir. and telling to select an org.');
		return res.redirect('/?alert=' + res.msgUrl('selectOrg'));
	}
	
	//search for organization in database
	let selectedOrg = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	
	//If organization does not exist:
	if(!selectedOrg) {
		//If there is an org_key cookie, remove it
		if (req.cookies.org_key) {
			res.clearCookie('org_key');
		}
		//Redirect to home, without the invalid org_key query parameter
		return res.redirect(`/?redirectURL=${req.getFixedRedirectURL()}`);
	}
	
	//Now, sign in to organization's default user
	let defaultUser = await utilities.findOne<any>('users', 
		{org_key: org_key, name: 'default_user'}, {},
		{allowCache: true}
	);
	logger.debug(`defaultUser=${JSON.stringify(defaultUser)}`);
	
	if(!defaultUser){
		logger.debug('No default user');
		return res.redirect(`/user/switchorg?alert=Error: No default user for organization ${org_key} exists in database.`);
	}
	
	//gotta catch if the person pressed the back button first, then gotta log out before loggin in
	if( req.user ){
		//destroy session then log in to default user
		req.logout(() => {
			doLogin();
		});
		logger.debug('req.user is defined, so we are logging them out first');
	}
	else {
		doLogin();
	}
	
	function doLogin() {	
		//Now, log in to defaultUser
		req.logIn(defaultUser, function(err){
		
			logger.debug('defaultUser logged in');
		
			//set org_key cookie to selected organization
			logger.debug('Setting org_key cookie');
			res.cookie('org_key', org_key, {maxAge: 30E9});
			
			//If error, then log and return an error
			if(err){ logger.error(err); return res.status(500).send({alert: err}); }
		
			cb();
		});
	}
}


export default router;

/**
 * Get a number from an AnyDict, defaulting to 0. Easier than doing an inline ternary for each variable.
 */
function getNumberFrom(dict: AnyDict|MatchFormData|undefined, key: string): number {
	if (!dict) return 0;
	let thisItem = dict[key];
	if (typeof thisItem === 'number') return thisItem;
	else return 0;
}
