import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import { upload as uploadHelper } from '@firstteam102/scoutradioz-helpers';
import { MatchScouting, Team, Layout, PitScouting, User, MatchTeamKey, Upload, Match, AnyDict, MatchFormData } from '@firstteam102/scoutradioz-types';
import e from '@firstteam102/http-errors';

const router = express.Router();
const logger = getLogger('scoutingaudit');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));
	
declare interface AuditElement {
	match_team_key?: MatchTeamKey;
	actual_scorer?: string;
	char?: string;
}

/**
 * Scoring audit page.
 * @url /manage/scoringaudit
 * @view /manage/index, /manage/scoringaudit
 */
router.get('/', wrap(async (req, res) =>  {
	
	let thisFuncName = 'audit.root[GET]:';
	logger.debug(`${thisFuncName} enter`);
	
	let eventKey = req.event.key;
	let org_key = req._user.org_key;

	let matches: Match[] = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': -1 }, {sort: {'time': 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	if (matches && matches[0]) {
		let earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug('Scoring audit: earliestTimestamp=' + earliestTimestamp);
	
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scoreData: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $lt: earliestTimestamp }}, { sort: {'assigned_scorer': 1, 'time': 1, 'alliance': 1, 'team_key': 1} });
	
	if(!scoreData)
		return res.redirect('/?alert=mongo error at dashboard/matches');

	// Build per-team-member array
	let memberArr = [];
	let lastMember: string|undefined = 'NOLASTMEMBER';
	let thisMemberArr = [];

	if (scoreData && scoreData.length > 0) {
		for (let scoreIdx = 0; scoreIdx < scoreData.length; scoreIdx++) {
			let thisScoreData = scoreData[scoreIdx];
			let thisMember = thisScoreData.assigned_scorer;
						
			if (thisMember != lastMember) {
				let thisRow = {
					member: lastMember,
					record: thisMemberArr
				};
				if ('NOLASTMEMBER' != lastMember)
					memberArr.push(thisRow);
				
				lastMember = thisMember;
				thisMemberArr = [];
			}
			
			//create audit-element to push
			let auditElement: AuditElement = {};
			let auditElementChar;
			//set auditElement.match_team_key
			if(thisScoreData){
				auditElement.match_team_key = thisScoreData.match_team_key;
			}
			
			if (thisScoreData.data){
				
				if (thisScoreData.assigned_scorer == thisScoreData.actual_scorer)
					auditElementChar = 'Y';
				else
				// 2019-03-16 JL: App crashed due to actual_scorer being undefined
				if (thisScoreData.actual_scorer == undefined){
					logger.debug(`${thisFuncName} actual_scorer undefined`);
					auditElementChar = 'N';
				}
				// 2018-03-22, M.O'C: Adding parent option
				else if (thisScoreData.actual_scorer.toLowerCase().startsWith('mr') || 
						thisScoreData.actual_scorer.toLowerCase().startsWith('mrs') || 
						thisScoreData.actual_scorer.toLowerCase().startsWith('ms')){
					//covered by parent (and insert actual_scorer)
					auditElementChar = 'P';
					auditElement.actual_scorer = thisScoreData.actual_scorer;
				}
				else{
					//covered by lead (and insert actual_scorer)
					auditElementChar = 'C';
					auditElement.actual_scorer = thisScoreData.actual_scorer;
				}		
			}
			else{
				auditElementChar = 'N';
			}
			
			//set auditElement's char to what we set above, then push to member array
			auditElement.char = auditElementChar;
			thisMemberArr.push(auditElement);
			
		}
		// Write in the last set of records
		let thisRow = {
			member: lastMember,
			record: thisMemberArr
		};
		memberArr.push(thisRow);
	}

	res.render('./manage/audit/index',{
		title: 'Scouter Audit',
		audit: memberArr
	});
}));

router.get('/uploads', wrap(async (req, res) => {
	
	const org_key = req._user.org_key;
	
	// Get the year from either the HTTP query or the current event
	let year;
	if (typeof req.query.year === 'string') year = parseInt(req.query.year);
	if (!year || isNaN(year)) year = req.event.year;
	
	let uploads: Upload[] = await utilities.find('uploads', 
		{org_key: org_key, removed: false, year: year},
		{},
	);
	
	// Years that contain any non-removed uploads
	let years: string[] = await utilities.distinct('uploads', 'year', {org_key: org_key, removed: false});
	
	uploads.sort((a, b) => {
		let aNum = parseInt(a.team_key.substring(3));
		let bNum = parseInt(b.team_key.substring(3));
		if (aNum == bNum) {
			let aIdx = a.index;
			let bIdx = b.index;
			if (aIdx == bIdx) {
				let aTime = a.uploader.upload_time;
				let bTime = b.uploader.upload_time;
				return aTime - bTime;
			}
			else {
				return aIdx - bIdx;
			}
		}
		else {
			return aNum - bNum;
		}
	});
	
	// 2022-03-08 JL: Previous logic didn't work, it always left out at least one document
	let uploadsByTeamKey: Dict<Upload[]> = {};
	for (let upload of uploads) {
		upload.links = uploadHelper.getLinks(upload);
		if (upload.hasOwnProperty('team_key')) {
			let key = upload.team_key;
			if (!uploadsByTeamKey[key]) uploadsByTeamKey[key] = [];
			uploadsByTeamKey[key].push(upload);
		}
	}
	
	/*
	//Sort into groups of teams
	var uploadsByTeam = [];
	var thisTeamKey, thisTeamUploads = [];
	for (var upload of uploads) {
		var thisTeamLinks = uploadHelper.getLinks(upload);
		upload.links = thisTeamLinks;
		if (upload.hasOwnProperty('team_key')) {
			//If thisUpload matches thisTeam, add to thisTeamUploads
			if (thisTeamKey == upload.team_key) {
				thisTeamUploads.push(upload);
			}
			//If not a match, then push thisTeamUploads, reset it and set thisTeamKey
			else {
				uploadsByTeam.push(thisTeamUploads);
				thisTeamUploads = [];
				thisTeamUploads.push(upload);
				thisTeamKey = upload.team_key;
			}
		}
	}
	//get rid of first empty array (due to the way my loop was structured)
	uploadsByTeam.splice(0, 1);
	*/
	
	res.render('./manage/audit/uploads', {
		title: 'Uploads Audit',
		uploadsByTeam: uploadsByTeamKey,
		years: years,
		thisYear: year,
	});
}));

router.post('/uploads/changeindex', wrap(async (req, res) => {
	let thisFuncName = 'audit.uploads.changeindex: ';
	
	try {
		logger.debug(`${thisFuncName} ENTER`);
		
		let uploadId = req.body.id;
		let changeAmt = parseInt(req.body.amount);
		let orgKey = req._user.org_key;
	
		let upload: Upload = await utilities.findOne('uploads', {_id: uploadId, org_key: orgKey, removed: false});
		
		if (upload) {
			
			let newIndex = upload.index + changeAmt;
			
			let writeResult = await utilities.update('uploads',
				{_id: uploadId, org_key: orgKey},
				{$set: {index: newIndex}}
			);
			
			logger.debug(`${thisFuncName} writeResult=${writeResult}`);
			res.status(200).send(writeResult);
		}
		else {
			logger.error(`${thisFuncName} Could not find upload in db, id=${uploadId}`);
			res.status(400).send('Could not find upload in database.');
		}
	}
	catch (err) {
		logger.error(err);
		res.status(500).send(JSON.stringify(err));
	}
}));

router.post('/uploads/delete', wrap(async (req, res) => {
	let thisFuncName = 'audit.uploads.delete: ';
	
	try {
		logger.debug(`${thisFuncName} ENTER`);
		
		let uploadId = req.body.id;
		let orgKey = req._user.org_key;
	
		let upload: Upload = await utilities.findOne('uploads', {_id: uploadId, org_key: orgKey, removed: false});
		
		if (upload) {
			
			logger.info(`${req._user} has deleted: ${JSON.stringify(upload)}`);
			
			let writeResult = await utilities.update('uploads',
				{_id: uploadId, org_key: orgKey},
				{$set: {removed: true}}
			);
			
			logger.debug(`${thisFuncName} writeResult=${writeResult}`);
			res.status(200).send(writeResult);
		}
		else {
			logger.error(`${thisFuncName} Could not find upload in db, id=${uploadId}`);
			res.status(400).send('Could not find upload in database.');
		}
	}
	catch (err) {
		logger.error(err);
		res.status(500).send(JSON.stringify(err));
	}
}));

router.get('/bymatch', wrap(async (req, res) => {
	
	let eventKey = req.event.key;
	let org_key = req._user.org_key;

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	let matches: Match[] = await utilities.find('matches', {event_key: eventKey, 'alliances.red.score': -1}, {sort: {'time': 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	
	if (matches[0]){
		let earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug('Per-match audit: earliestTimestamp=' + earliestTimestamp);
	
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scoreData: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $lt: earliestTimestamp }}, { sort: {'time': 1, 'alliance': 1, 'team_key': 1} });
	
	//Create array of matches for audit, with each match-team inside each match
	let audit = [];
	
	if (scoreData.length == 0) {
		return res.render('./manage/audit/bymatch', {
			title: 'Match Scouting Audit',
			audit: null
		});
	}
	
	let lastMatchNum = scoreData[0].match_number;
	
	for(let i = 0; i < scoreData.length; i++){
		
		let thisMatchNum  = scoreData[i].match_number;
		
		//if we finished going through last match, go to next match and create a new array to push to audit
		if(thisMatchNum > lastMatchNum || i == 0){
			lastMatchNum = thisMatchNum;
			
			let matchTeamArr = [];
			
			//go through the next 6 elements in scoreData and add to matchTeamArr
			for(let j = 0; j < 6; j++){
				
				let thisMatchTeam = scoreData[i + j];
				let thisMatchTeamNum = thisMatchTeam.match_number;
				
				//if scoreData[i+j] is the same match as thisMatchNum, insert into matchTeamArr
				if(thisMatchTeamNum == thisMatchNum){
					matchTeamArr.push(thisMatchTeam);
				}
				//if not, JUST IN CASE something went wrong with the data, push an object with scored: false
				else{
					matchTeamArr.push({
						'match_number': thisMatchNum,
						'scored': false
					});
				}
				//this way, each matchTeamArr is 6 objects large
			}
			
			//finally, push matchTeamArr
			audit.push(matchTeamArr);
		}
	}
	
	res.render('./manage/audit/bymatch', {
		title: 'Match Scouting Audit',
		'audit': audit
	});
}));

router.get('/comments', wrap(async (req, res) => {
	
	let eventKey = req.event.key;
	let org_key = req._user.org_key;
		
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	let matches: Match[] = await utilities.find('matches', {event_key: eventKey, 'alliances.red.score': -1}, {sort: {'time': 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	
	if (matches[0]){
		let earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug('Comments audit: earliestTimestamp=' + earliestTimestamp);
		
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scoreData: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $lt: earliestTimestamp }}, { sort: {'actual_scorer': 1, 'time': 1, 'alliance': 1, 'team_key': 1} });
	
	let audit = [];
	
	for(let item of scoreData){
		if(item.data && item.data.otherNotes != ''){
			audit.push(item);
		}
	}
	
	res.render('./manage/audit/comments', {
		title: 'Scouter Comments Audit',
		'audit': audit
	});
}));

router.get('/matchscores', wrap(async (req, res) => {
	logger.addContext('funcName', 'matchscores[get]');
	logger.info('ENTER');

	let eventKey = req.event.key;
	let orgKey = req._user.org_key;
	
	let lookbackto = req.query.lookbackto;
	if (typeof lookbackto !== 'string')
		lookbackto = '1';
	let lookbacktoIndex = parseInt(lookbackto) - 1;
	
	let matches: Match[] = await utilities.find('matches',
		{ 'event_key': eventKey, 'match_number': { '$gt': lookbacktoIndex }, 'score_breakdown': { '$ne': null } }, { sort: { match_number: -1 } },
		{allowCache: true, maxCacheAge: 10}
	);

	// set up the return data table - we'll add alternating rows of FRC & scouting data
	let returnCompareTable = [];
	// dictionary of scouts - each item should be keyed by scout name and contain (a) total matches scouted + (b) total error point diffs & ratios	
	let scoutScoreDict: Dict<{count: number, avgDiff: number, avgRatio: number, totDiff: number, totRatio: number}> = {};

	// cycle through match objects; for each one, cycle through 'red' and 'blue' array
	// for each alliance, pull scouting data - if less than 3 found, can't compare
	let allianceArray: Array<'red'|'blue'> = ['red', 'blue'];
	for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
		let thisMatch = matches[matchIdx];
		for (let allianceIdx = 0; allianceIdx < allianceArray.length; allianceIdx++) {
			let thisAlliance = allianceArray[allianceIdx];
			console.log('thisAlliance=' + thisAlliance + ',thisMatch.key=' + thisMatch.key);

			// retrieve the scouting data for this match
			let matchScoutReports: MatchScouting[] = await utilities.find('matchscouting',
				{ 'event_key': eventKey, 'match_key': thisMatch.key, 'data': { '$ne': null }, 'alliance': thisAlliance }, { sort: { actual_scorer: 1 } }
			);
			console.debug('matchScoutReports.length=' + matchScoutReports.length);
			// can't compare if we don't have three (3) scouting reports
			if (matchScoutReports.length != 3) {
				// TODO
			}
			else {
				let thisScoreBreakdown = thisMatch.score_breakdown[thisAlliance];
				let totalPoints = getNumberFrom(thisScoreBreakdown, 'totalPoints');
				let foulPoints = getNumberFrom(thisScoreBreakdown, 'foulPoints');
				let teleopPoints = getNumberFrom(thisScoreBreakdown, 'teleopPoints');
				let endgamePoints = getNumberFrom(thisScoreBreakdown, 'endgamePoints');
				let frcTot = totalPoints - foulPoints;

				let orgTot = 0;
				let orgAutoTot = 0;
				let orgTeleTot = 0;
				let orgEndTot = 0;
				let orgTaxiTot = 0;
				let orgAutoLow = 0;
				let orgAutoHigh = 0;
				let orgTeleLow = 0;
				let orgTeleHigh = 0;
				for (let scoutIdx = 0; scoutIdx < matchScoutReports.length; scoutIdx++) {
					let thisScoutReport = matchScoutReports[scoutIdx].data;
					orgTot += getNumberFrom(thisScoutReport, 'contributedPoints');
					orgAutoTot += getNumberFrom(thisScoutReport, 'autoPoints');
					orgTeleTot += getNumberFrom(thisScoutReport, 'teleopPoints');
					orgEndTot += getNumberFrom(thisScoutReport, 'climbPoints');
					orgTaxiTot += getNumberFrom(thisScoutReport, 'didTaxi');
					orgAutoLow += getNumberFrom(thisScoutReport, 'autoLowScored');
					orgAutoHigh += getNumberFrom(thisScoutReport, 'autoHighScored');
					orgTeleLow += getNumberFrom(thisScoutReport, 'teleopLowScored');
					orgTeleHigh += getNumberFrom(thisScoutReport, 'teleopHighScored');
				}

				// score
				let errDiff = Math.abs(orgTot - frcTot);
				let errRatio = errDiff / frcTot;
				if (errRatio > 1.0)
					errRatio = 1.0;

				// track scores
				for (let scoutIdx = 0; scoutIdx < matchScoutReports.length; scoutIdx++) {
					let thisScoutName = matchScoutReports[scoutIdx].actual_scorer;
					if (!thisScoutName) {
						logger.trace('No actual_scorer for scout report idx=' + scoutIdx);
						continue;
					}
					let thisScoutRecord = scoutScoreDict[thisScoutName];
					if (!thisScoutRecord) {
						scoutScoreDict[thisScoutName] = {count: 1, avgDiff: errDiff, avgRatio: errRatio, totDiff: errDiff, totRatio: errRatio};
					}
					else {
						let newCount = thisScoutRecord.count + 1;
						let newTotDiff = thisScoutRecord.totDiff + errDiff;
						let avgDiff = newTotDiff / newCount;
						let newTotRatio = thisScoutRecord.totRatio + errRatio;
						let avgRatio = newTotRatio / newCount;
						scoutScoreDict[thisScoutName] = {count: newCount, avgDiff: avgDiff, avgRatio: avgRatio, totDiff: newTotDiff, totRatio: newTotRatio};
					}
				}

				let frcRow = [];
				frcRow.push(thisMatch.key + ' - ' + thisAlliance);
				frcRow.push('');
				frcRow.push('');
				frcRow.push(frcTot);
				frcRow.push(getNumberFrom(thisScoreBreakdown, 'autoPoints'));
				frcRow.push(teleopPoints - endgamePoints);
				frcRow.push(getNumberFrom(thisScoreBreakdown, 'endgamePoints'));
				let frcTaxi = 0;
				for (let robotIdx = 1; robotIdx < 4; robotIdx++)
					if (thisScoreBreakdown['taxiRobot' + robotIdx] == 'Yes')
						frcTaxi++;
				frcRow.push(frcTaxi);
				frcRow.push(getNumberFrom(thisScoreBreakdown, 'autoCargoLowerBlue') + getNumberFrom(thisScoreBreakdown, 'autoCargoLowerFar') + getNumberFrom(thisScoreBreakdown, 'autoCargoLowerNear') + getNumberFrom(thisScoreBreakdown, 'autoCargoLowerRed'));
				frcRow.push(getNumberFrom(thisScoreBreakdown, 'autoCargoUpperBlue') + getNumberFrom(thisScoreBreakdown, 'autoCargoUpperFar') + getNumberFrom(thisScoreBreakdown, 'autoCargoUpperNear') + getNumberFrom(thisScoreBreakdown, 'autoCargoUpperRed'));
				frcRow.push(getNumberFrom(thisScoreBreakdown, 'teleopCargoLowerBlue') + getNumberFrom(thisScoreBreakdown, 'teleopCargoLowerFar') + getNumberFrom(thisScoreBreakdown, 'teleopCargoLowerNear') + getNumberFrom(thisScoreBreakdown, 'teleopCargoLowerRed'));
				frcRow.push(getNumberFrom(thisScoreBreakdown, 'teleopCargoUpperBlue') + getNumberFrom(thisScoreBreakdown, 'teleopCargoUpperFar') + getNumberFrom(thisScoreBreakdown, 'teleopCargoUpperNear') + getNumberFrom(thisScoreBreakdown, 'teleopCargoUpperRed'));

				let orgRow = [];
				if (!matchScoutReports[0].actual_scorer || !matchScoutReports[1].actual_scorer || !matchScoutReports[2].actual_scorer) {
					throw new e.InternalServerError('actual_scorer not defined for the first three matchScoutReports');
				}
				orgRow.push(matchScoutReports[0].actual_scorer.split(' ')[0]
					+ ', ' + matchScoutReports[1].actual_scorer.split(' ')[0]
					+ ', ' + matchScoutReports[2].actual_scorer.split(' ')[0]);
				orgRow.push(errDiff);
				orgRow.push(errRatio);
				orgRow.push(orgTot);
				orgRow.push(orgAutoTot);
				orgRow.push(orgTeleTot);
				orgRow.push(orgEndTot);
				orgRow.push(orgTaxiTot);
				orgRow.push(orgAutoLow);
				orgRow.push(orgAutoHigh);
				orgRow.push(orgTeleLow);
				orgRow.push(orgTeleHigh);
				
				console.log('FRC=' + JSON.stringify(frcRow));
				console.log('Org=' + JSON.stringify(orgRow));

				returnCompareTable.push(frcRow);
				returnCompareTable.push(orgRow);
			}
		}
	}
	// final results
	console.log('scoutScoreDict=' + JSON.stringify(scoutScoreDict));

	//logger.debug('match=' + JSON.stringify(match));
	res.render('./manage/audit/matchscores', { // TODO: change url to something more representative of what it is
		title: 'Scoring Audit for Matches',
		compareTable: returnCompareTable,
		scouterScoring: scoutScoreDict
	});
}));

module.exports = router;

/**
 * Get a number from an AnyDict, defaulting to 0. Easier than doing an inline ternary for each variable.
 */
function getNumberFrom(dict: AnyDict|MatchFormData|undefined, key: string): number {
	if (!dict) return 0;
	let thisItem = dict[key];
	if (typeof thisItem === 'number') return thisItem;
	else return 0;
}
