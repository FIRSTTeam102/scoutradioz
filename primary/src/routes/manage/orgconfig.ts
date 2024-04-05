import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import type { MongoDocument } from 'scoutradioz-utilities';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e, { HttpError, assert } from 'scoutradioz-http-errors';
import type { Layout, LayoutEdit, Match, MatchScouting, MatchFormData } from 'scoutradioz-types';
import type { DeleteResult, InsertManyResult } from 'mongodb';
import { getSubteamsAndClasses } from '../../helpers/orgconfig';
import { matchData as matchDataHelper } from 'scoutradioz-helpers';
//import { write } from 'fs';

const router = express.Router();
const logger = getLogger('orgconfig');

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {

	const org = req._user.org;
	
	// Get a list of the team numbers at this org
	let team_numbers: string[] = [];
	if (org.team_key) team_numbers.push(org.team_key.substring(3));
	if (org.team_keys) team_numbers.push(...org.team_keys.map(key => key.substring(3)));


	res.render('./manage/config/index', {
		title: req.msg('manage.config.title', {org: org.nickname}),
		org,
		team_numbers,
	});

}));

router.post('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[post]');

	try {

		const org_key = req.body.org_key;
		const nickname = req.body.nickname;

		assert(org_key === req._user.org.org_key, new e.UnauthorizedError(`Unauthorized to edit org ${org_key}`));

		logger.info(`Updating org ${org_key}, nickname=${nickname}`);
		let { subteams, classes, uniqueClassKeys, uniqueSubteamKeys } = getSubteamsAndClasses(req.body);
		logger.debug(`subteams=${JSON.stringify(subteams)} classes=${JSON.stringify(classes)}`);

		// Get the list of team numbers provided
		let teamNumbersStr = req.body.team_numbers;
		assert(typeof teamNumbersStr === 'string', new e.UserError('Team numbers not provided'));
		
		// Parse the team numbers provided. If an empty string is provided, then assume that means no teams on the org.
		let teamNumbers: number[] = [];
		if (teamNumbersStr.trim() !== '') {
			teamNumbers = teamNumbersStr.split(',').map(str => parseInt(str.trim()));
			// Make sure they're all valid ints
			assert(!teamNumbers.some(number => isNaN(number)), new e.UserError('Please enter a comma-separated list of FRC team numbers.'));
			assert(teamNumbers.length < 20, new e.UserError('Too many team numbers provided! (Max = 20)'));
			for (let team_number of teamNumbers) {
				let team = await utilities.findOne('teams', {team_number});
				assert(team, new e.UserError(req.msg('manage.config.invalidTeams', {number: team_number})));
			}
		}

		// Check for users which don't have a class key or subteam key in the list
		let usersWithInvalidKeys = await utilities.find('users', {
			org_key,
			visible: true,
			$or: [
				{ 'org_info.class_key': { $not: { $in: uniqueClassKeys } } },
				{ 'org_info.subteam_key': { $not: { $in: uniqueSubteamKeys } } }
			]
		});

		//Create update query
		let updateQuery: MongoDocument = {
			$set: {
				nickname: nickname,
				'config.members.subteams': subteams,
				'config.members.classes': classes,
			},
		};
		
		// 1 team key and team number
		if (teamNumbers.length === 1) {
			updateQuery.$set.team_number = teamNumbers[0];
			updateQuery.$set.team_key = 'frc'+teamNumbers[0];
			// Remove the team_numbers/team_keys field
			updateQuery.$unset = {
				team_numbers: true,
				team_keys: true,
			};
		}
		// No teams / team_keys provided
		else if (teamNumbers.length === 0) {
			updateQuery.$unset = {
				team_numbers: true,
				team_keys: true,
				team_number: true,
				team_key: true,
			};
		}
		// Multiple team keys and team numbers
		else {
			updateQuery.$set.team_numbers = teamNumbers;
			updateQuery.$set.team_keys = teamNumbers.map(number => 'frc'+number);
			updateQuery.$unset = {
				team_number: true,
				team_key: true,
			};
		}

		logger.debug(`updateQuery=${JSON.stringify(updateQuery)}`);

		const writeResult = await utilities.update('orgs',
			{ org_key }, updateQuery
		);

		logger.debug(`writeResult=${JSON.stringify(writeResult)}`);

		// 2024-04-04 JL: Changed to AJAX
		if (usersWithInvalidKeys.length === 0) {
			return res.status(200).send(req.msg('manage.config.updatedSuccessfully'));
		}
		else {
			return res.status(200).send(req.msg('manage.config.updatedButFixSubteams'));
		}
	}
	catch (err) {
		logger.error(err);
		// 2024-04-04 JL: Changed to AJAX
		if (err instanceof HttpError)
			return res.status(err.status).send(String(err));
		else
			return res.status(400).send(String(err));
	}
}));

router.post('/setdefaultpassword', wrap(async (req, res) => {

	let newDefaultPassword = req.body.defaultPassword;

	let hash = await bcrypt.hash(newDefaultPassword, 10);

	await utilities.update('orgs', { org_key: req._user.org_key }, { $set: { default_password: hash } });

	res.redirect(`/manage?alert=Successfully changed password to ${newDefaultPassword}.`);

}));

router.get('/editform', wrap(async (req, res) => {
	let thisFuncName = 'orgconfig.editform(root): ';

	if (!await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) return;

	let form_type = req.query.form_type;

	assert(form_type === 'matchscouting' || form_type === 'pitscouting', new e.UserError('Invalid form type'));

	let org_key = req._user.org_key;

	let yearStr = req.query.year || req.event.key;
	let year: number;
	if (typeof yearStr === 'string') year = parseInt(yearStr);
	else throw new e.UserError('Either "year" or "key" must be set.');

	// load form definition data from the database
	let layoutArray: Layout[] = await utilities.find('layout', { org_key: org_key, year: year, form_type: form_type }, { sort: { 'order': 1 } });
	// strip out _id, form_type, org_key, year, order
	let updatedArray = layoutArray.map((element) => {
		let newElement: LayoutEdit = element;
		delete newElement['_id'];
		delete newElement['form_type'];
		delete newElement['org_key'];
		delete newElement['year'];
		delete newElement['order'];
		return newElement;
	});
	// create a string representation
	let layout = JSON.stringify(updatedArray, null, 2);
	//logger.debug(thisFuncName + 'layout=\n' + layout);

	let existingFormData = new Map<string, string>();
	let previousDataExists = false;
	// get existing data schema (if any)
	let matchDataFind: MatchScouting[] = await utilities.find('matchscouting', { org_key, year, 'data': { $ne: null } }, {});
	matchDataFind.forEach((element) => {
		let thisMatch: MatchScouting = element;
		if (thisMatch['data']) {
			previousDataExists = true;
			let thisData: MatchFormData = thisMatch['data'];
			let dataKeys = Object.keys(thisData);
			//logger.debug(`dataKeys=${JSON.stringify(dataKeys)}`);
			dataKeys.forEach(function(value) {
				//logger.debug(`value=${value}`);
				existingFormData.set(value, value);
			});
		}
	});
	//logger.debug(`existingFormData=${JSON.stringify(existingFormData)}`);
	//logger.debug(`existingFormData=${existingFormData}`);
	let previousKeys: string[] = [];
	if (previousDataExists)
		for (let key of existingFormData.keys())
			if (key != 'match_team_key') {
				//logger.debug(`key=${key}`);
				previousKeys.push(key);
			}
	//logger.debug(`previousKeys=${JSON.stringify(previousKeys)}`);

	let title = 'Pit Scouting Layout';
	if (form_type == 'matchscouting')
		title = 'Match Scouting Layout';

	logger.debug(`previousDataExists=${previousDataExists}`);
	logger.debug(`previousKeys=${JSON.stringify(previousKeys)}`);

	res.render('./manage/config/editform', {
		title: title,
		layout: layout,
		form_type: form_type,
		org_key: org_key,
		year: year,
		previousDataExists: previousDataExists,
		previousKeys: previousKeys
	});
}));

router.post('/submitform', wrap(async (req, res) => {
	logger.addContext('funcName', 'submitform[post]');
	logger.info('ENTER');

	if (!await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) return;

	let thisUser = req._user;
	// only let a user logged into the org modify their own org_key
	let org_key = thisUser.org_key;
	logger.debug('org_key=' + org_key);

	let jsonString = req.body.jsonData;
	//logger.debug('jsonString=' + jsonString);
	let year = parseInt(req.body.year);
	logger.debug('year=' + year);
	let form_type = req.body.form_type;
	logger.debug('form_type=' + form_type);

	let formdata: Layout[] = JSON.parse(jsonString);
	formdata.forEach((element, i) => {
		// just in case the submission has '_id' attributes, remove them
		delete element['_id'];
		// write (or override existing) attributes
		element.form_type = form_type;
		element.org_key = org_key;
		element.year = year;
		// add order key to each object
		element.order = i;
	});
	let updatedString = JSON.stringify(formdata);
	logger.debug('updatedString=' + updatedString);

	// 1. delete existing data {if any} matching form_type, org_key, year
	let removeResult: DeleteResult = await utilities.remove('layout', { org_key: org_key, year: year, form_type: form_type });
	logger.info(`Removed ${removeResult.deletedCount} prior form records`);

	// 2. write in new/updated data
	let writeResult: InsertManyResult<MongoDocument> | undefined = await utilities.insert('layout', formdata);
	if (writeResult)
		logger.info(`Inserted ${writeResult.insertedCount} new form records`);
	else
		logger.warn('Inserted 0 new form records!');

	res.redirect('/manage');
}));

router.get('/inferpredictive', wrap(async (req, res) => {
	if (!await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) return;
	logger.addContext('funcName', 'submitform[post]');
	logger.info('ENTER');

	// for later querying by event_key
	let eventKey = req.event.key;
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	logger.debug('event_key=' + eventKey);

	// Get the currently completed matches
	// Match history info
	let matches: Match[] = await utilities.find('matches', {'alliances.red.score': { $ne: -1}, 'event_key' : eventKey}, {sort: {time: -1}});

	// 
	// Currently replicated from reports/allteammetrics
	//
	let cookie_key = orgKey + '_' + eventYear + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	// build the aggregation data
	let aggQuery = [];
	aggQuery.push({ $match : { 'org_key': orgKey, 'event_key': eventKey } });

	// get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);

	// initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};

	// iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		// pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		// if it is a valid data type, add this layout's ID to groupClause
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
	
	let groupClause: MongoDocument = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		// if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	aggQuery.push({ $sort: { _id: 1 } });

	// get the result 
	let aggR = await utilities.aggregate('matchscouting', aggQuery);
	let aggArray = [];
	if (aggR && aggR.length > 0) {
		logger.debug('Have agg values');
		aggArray = aggR;
		// aggArray=[{"_id":"frc102","contributedPointsAVG":7.24,"contributedPointsMAX":15,"totalAutoPointsAVG":1.8,"totalAutoPointsMAX":5,"totalTeleopPointsAVG":4.8,...},
		//           {"_id":"frc103","contributedPointsAVG":23.76,"contributedPointsMAX":26,"totalAutoPointsAVG":12,"totalAutoPointsMAX":15,"totalTeleopPointsAVG":8.4...},
		//           {...}, ...]
		//logger.debug(`aggArray=${JSON.stringify(aggArray)}`);

		// build a map of agg rows by team key
		let aggByTeam: { [id: string]: any } = {};
		for (let aggIdx in aggArray) {
			let thisAgg = aggArray[aggIdx];
			let thisKey = thisAgg['_id'];
			aggByTeam[thisKey] = thisAgg;
		}

		// array of metric success levels
		let metricPredictive: { key: string, predSuccess: number }[] = [];

		// go through each 'AVG' metric
		let firstAgg = aggArray[0];
		logger.debug(`firstAgg=${JSON.stringify(firstAgg)}`);
		let aggKeys = Object.keys(firstAgg);
		for (let metricIdx in aggKeys) {
			let thisMetric = aggKeys[metricIdx];
			// needs to have 'AVG' in it
			if (thisMetric.includes('AVG')) {
				//logger.debug(`thisMetric=${thisMetric}`);

				// per metric tracking
				let metricArray: string[] = [ thisMetric ];
				let metricFactors: number[] = [ 1.0 ];
				let { successfulPred, thisMetricRatioAvg } = calcPredictiveRates(matches, aggByTeam, metricArray, metricFactors);

				//logger.debug(`thisMetric=${thisMetric}: successfulPred=${successfulPred}, thisMetricRatioAvg=${thisMetricRatioAvg}`);
				metricPredictive.push({key: thisMetric, predSuccess: (successfulPred + thisMetricRatioAvg)});
			}
		}

		// sort by 'predSuccess'
		metricPredictive.sort(function(a, b) {
			if (a.predSuccess > b.predSuccess) return -1;
			if (a.predSuccess < b.predSuccess) return 1;
			return 0;
		});
		logger.debug(`sorted metricPredictive=${JSON.stringify(metricPredictive)}`);

		// TODO make this interactive
		let numPredMetrics = metricPredictive.length;
		let convergeRate = .05;    // what % of the distance to 1.0 to go each test/move
		let maxIterations = 100;  // if we haven't converged by now... 

		//
		// if the number of metrics to process is 2 or more...
		//
		if (numPredMetrics > 1) {
			// initialize the factors with equal parts from 1.0 total\
			let metricArr: string[] = [];
			let factorArr: number[] = [];
			for (let factorIdx = 0; factorIdx < numPredMetrics; factorIdx++) {
				metricArr.push(metricPredictive[factorIdx].key);
				logger.debug(`${factorIdx}: ${metricPredictive[factorIdx].key}`);
				factorArr.push(1.0/numPredMetrics);
			}

			let foundMaxima = false;
			let { successfulPred, thisMetricRatioAvg } = calcPredictiveRates(matches, aggByTeam, metricArr, factorArr);
			let thisPredSuccess = successfulPred + thisMetricRatioAvg;
			//logger.debug(`initial values: successfulPred=${successfulPred}, thisMetricRatioAvg=${thisMetricRatioAvg}`);

			for (let thisIter = 0; thisIter < maxIterations; thisIter++) {
				logger.debug(`factorArr=${JSON.stringify(factorArr)} - thisPredSuccess=${thisPredSuccess}`);
				let foundBetter = false;
				let betterPredSuccess = thisPredSuccess;
				let betterFactorIdx = -1;
				let betterFactors: number[] = [];
				for (let betterIdx = 0; betterIdx < numPredMetrics; betterIdx++)
					betterFactors.push(0.0);

				for (let factorIdx = 0; factorIdx < numPredMetrics; factorIdx++) {
					// which direction to go? for each factor, tweak that one toward 1.0 and the others down 
					let testFactorArr: number[] = [];
					let currentTestFactor = factorArr[factorIdx];
					let otherFactors = (1.0 - currentTestFactor);
					let adjustment = (1.0 - currentTestFactor) * convergeRate;
					currentTestFactor = currentTestFactor + adjustment;

					for (let testFactorIdx = 0; testFactorIdx < numPredMetrics; testFactorIdx++) {
						if (testFactorIdx == factorIdx)
							testFactorArr.push(currentTestFactor);
						else
							testFactorArr.push(factorArr[testFactorIdx] * ((otherFactors - adjustment) / otherFactors));
					}

					let { successfulPred, thisMetricRatioAvg } = calcPredictiveRates(matches, aggByTeam, metricArr, testFactorArr);
					let testPredSuccess = successfulPred + thisMetricRatioAvg;
					logger.trace(`test ${factorIdx}: testFactorArr=${JSON.stringify(testFactorArr)}... testPredSuccess=${testPredSuccess}`);

					// is it better?
					if (testPredSuccess > betterPredSuccess) {
						//logger.debug('found better so far');
						foundBetter = true;
						betterPredSuccess = testPredSuccess;
						betterFactorIdx = factorIdx;
						for (let betterIdx = 0; betterIdx < numPredMetrics; betterIdx++)
							betterFactors[betterIdx] = testFactorArr[betterIdx];
					}
				}

				// did we find a better one?
				if (foundBetter) {
					logger.debug(`Found better along #${betterFactorIdx}`);
					// update the factor array
					for (let betterIdx = 0; betterIdx < numPredMetrics; betterIdx++)
						factorArr[betterIdx] = betterFactors[betterIdx];

					thisPredSuccess = betterPredSuccess;
				}
				else {
					logger.debug('No better! Local maxima!');
					break;
				}
			}
		}
	}


	let title = 'Inferring predictive';

	res.render('./manage/config/inferpredictive', {
		title: title,
	});
}));

router.get('/pitsurvey', wrap(async (req, res) => {
	if (!await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) return;

	let org_key = req._user.org_key;

	let yearStr = req.query.year || req.event.key;
	let year: number;
	if (typeof yearStr === 'string') year = parseInt(yearStr);
	else throw new e.UserError('Either "year" or "key" must be set.');

	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var pitlayout = await utilities.find("scoutinglayout", {org_key: req.user.org_key, year: year}, {sort: {"order": 1}})
	let pitlayout: Layout[] = await utilities.find('layout', { org_key: org_key, year: year, form_type: 'pitscouting' }, { sort: { 'order': 1 } });

	res.render('./manage/config/pitsurvey', {
		title: 'Pit Survey Layout',
		pitlayout: pitlayout,
		year: year
	});

}));

module.exports = router;

function calcPredictiveRates(matches: Match[], aggByTeam: { [id: string]: any; }, metricList: string[], metricFactors: number[]) {
	let thisMetricRatioAvg = -1;
	let successfulPred = 0;

	// go through all the matches, see how predictive
	for (let matchIdx in matches) {
		let thisMatch = matches[matchIdx];
		let redAllianceList = thisMatch.alliances.red.team_keys;
		let blueAllianceList = thisMatch.alliances.blue.team_keys;

		let frcRedScore = thisMatch.alliances.red.score;
		let frcBlueScore = thisMatch.alliances.blue.score;
		let frcRatio = 1.0;
		if (frcRedScore > frcBlueScore)
			frcRatio = frcBlueScore / frcRedScore;
		if (frcBlueScore > frcRedScore)
			frcRatio = frcRedScore / frcBlueScore;

		// red prediction
		let predRedValue = 0;
		for (let teamIdx in redAllianceList) {
			let thisTeamKey = redAllianceList[teamIdx];
			for (let factorIdx in metricFactors) {
				let thisMetric = metricList[factorIdx];
				let thisFactor = metricFactors[factorIdx];
				predRedValue += (aggByTeam[thisTeamKey][thisMetric] * thisFactor);
			}
		}
		// blue prediction
		let predBlueValue = 0;
		for (let teamIdx in blueAllianceList) {
			let thisTeamKey = blueAllianceList[teamIdx];
			for (let factorIdx in metricFactors) {
				let thisMetric = metricList[factorIdx];
				let thisFactor = metricFactors[factorIdx];
				predBlueValue += (aggByTeam[thisTeamKey][thisMetric] * thisFactor);
			}
		}

		// compare
		let wasSuccessfulPred = false;
		let thisCompRatio = 1.0;
		let thisPredRatio = 1.0;

		if ((frcRedScore > frcBlueScore) && (predRedValue > predBlueValue)) {
			wasSuccessfulPred = true;
			thisPredRatio = predBlueValue / predRedValue;
		}
		if ((frcBlueScore > frcRedScore) && (predBlueValue > predRedValue)) {
			wasSuccessfulPred = true;
			thisPredRatio = predRedValue / predBlueValue;
		}
		if ((frcBlueScore == frcRedScore) && (predBlueValue == predRedValue)) {
			wasSuccessfulPred = true;
		}

		if (wasSuccessfulPred) {
			successfulPred += 1;
			if (frcRatio > thisPredRatio)
				thisCompRatio = thisPredRatio / frcRatio;
			if (thisPredRatio > frcRatio)
				thisCompRatio = frcRatio / thisPredRatio;

			if (successfulPred == 1)
				thisMetricRatioAvg = thisCompRatio;

			else
				thisMetricRatioAvg = ((thisMetricRatioAvg * (successfulPred - 1.0)) + thisCompRatio) / successfulPred;
		}
	}
	return { successfulPred, thisMetricRatioAvg };
}

