const router = require('express').Router();
const logger = require('log4js').getLogger();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const uploadHelper = require('@firstteam102/scoutradioz-helpers').upload;

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Scoring audit page.
 * @url /manage/scoringaudit
 * @view /manage/index, /manage/scoringaudit
 */
router.get('/', wrap(async (req, res) =>  {
	
	var thisFuncName = 'audit.root[GET]:';
	logger.debug(`${thisFuncName} enter`);
	
	var eventKey = req.event.key;
	var org_key = req.user.org_key;

	var matches = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': -1 }, {sort: {'time': 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (matches && matches[0]) {
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug('Scoring audit: earliestTimestamp=' + earliestTimestamp);
	
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoreData = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $lt: earliestTimestamp }}, { sort: {'assigned_scorer': 1, 'time': 1, 'alliance': 1, 'team_key': 1} });
	
	if(!scoreData)
		return res.redirect('/?alert=mongo error at dashboard/matches');

	// Build per-team-member array
	var memberArr = [];
	var lastMember = 'NOLASTMEMBER';
	var thisMemberArr = [];

	if (scoreData && scoreData.length > 0) {
		for (var scoreIdx = 0; scoreIdx < scoreData.length; scoreIdx++) {
			var thisMember = scoreData[scoreIdx].assigned_scorer;
			if (thisMember != lastMember) {
				let thisRow = {};
				thisRow['member'] = lastMember;
				thisRow['record'] = thisMemberArr;
				if ('NOLASTMEMBER' != lastMember)
					memberArr.push(thisRow);
				
				lastMember = thisMember;
				thisMemberArr = [];
			}
			
			//create audit-element to push
			var auditElement = {};
			var auditElementChar;
			//set auditElement.match_team_key
			if(scoreData[scoreIdx]){
				auditElement.match_team_key = scoreData[scoreIdx].match_team_key;
			}
			
			if (scoreData[scoreIdx].data){
				
				if (scoreData[scoreIdx].assigned_scorer == scoreData[scoreIdx].actual_scorer)
					auditElementChar = 'Y';
				else
				// 2019-03-16 JL: App crashed due to actual_scorer being undefined
				if (scoreData[scoreIdx].actual_scorer == undefined){
					logger.debug(`${thisFuncName} actual_scorer undefined`);
					auditElementChar = 'N';
				}
				// 2018-03-22, M.O'C: Adding parent option
				else if (scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('mr') || 
						scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('mrs') || 
						scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('ms')){
					//covered by parent (and insert actual_scorer)
					auditElementChar = 'P';
					auditElement.actual_scorer = scoreData[scoreIdx].actual_scorer;
				}
				else{
					//covered by lead (and insert actual_scorer)
					auditElementChar = 'C';
					auditElement.actual_scorer = scoreData[scoreIdx].actual_scorer;
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
		let thisRow = {};
		thisRow['member'] = lastMember;
		thisRow['record'] = thisMemberArr;
		memberArr.push(thisRow);
	}

	res.render('./manage/audit/index',{
		title: 'Scouter Audit',
		audit: memberArr
	});
}));

router.get('/uploads', wrap(async (req, res) => {
	
	const org_key = req.user.org_key;
	
	// Get the year from either the HTTP query or the current event
	var year = parseInt(req.query.year);
	if (!year || isNaN(year)) year = req.event.year;
	
	var uploads = await utilities.find('uploads', 
		{org_key: org_key, removed: false, year: year},
		{},
	);
	
	// Years that contain any non-removed uploads
	var years = await utilities.distinct('uploads', 'year', {org_key: org_key, removed: false});
	
	uploads.sort((a, b) => {
		var aNum = parseInt(a.team_key.substring(3));
		var bNum = parseInt(b.team_key.substring(3));
		if (aNum == bNum) {
			var aIdx = a.index;
			var bIdx = b.index;
			if (aIdx == bIdx) {
				var aTime = a.uploader.upload_time;
				var bTime = b.uploader.upload_time;
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
	var uploadsByTeamKey = {};
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
	var thisFuncName = 'audit.uploads.changeindex: ';
	
	try {
		logger.debug(`${thisFuncName} ENTER`);
		
		var uploadId = req.body.id;
		var changeAmt = parseInt(req.body.amount);
		var orgKey = req.user.org_key;
	
		var upload = await utilities.findOne('uploads', {_id: uploadId, org_key: orgKey, removed: false});
		
		if (upload) {
			
			var newIndex = upload.index + changeAmt;
			
			var writeResult = await utilities.update('uploads',
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
		res.status(500).send(err.message);
	}
}));

router.post('/uploads/delete', wrap(async (req, res) => {
	var thisFuncName = 'audit.uploads.delete: ';
	
	try {
		logger.debug(`${thisFuncName} ENTER`);
		
		var uploadId = req.body.id;
		var orgKey = req.user.org_key;
	
		var upload = await utilities.findOne('uploads', {_id: uploadId, org_key: orgKey, removed: false});
		
		if (upload) {
			
			logger.info(`${req.user} has deleted: ${JSON.stringify(upload)}`);
			
			var writeResult = await utilities.update('uploads',
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
		res.status(500).send(err.message);
	}
}));

router.get('/bymatch', wrap(async (req, res) => {
	
	var eventKey = req.event.key;
	var org_key = req.user.org_key;

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matches = await utilities.find('matches', {event_key: eventKey, 'alliances.red.score': -1}, {sort: {'time': 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	
	if (matches[0]){
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug('Per-match audit: earliestTimestamp=' + earliestTimestamp);
	
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoreData = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $lt: earliestTimestamp }}, { sort: {'time': 1, 'alliance': 1, 'team_key': 1} });
	
	//Create array of matches for audit, with each match-team inside each match
	var audit = [];
	
	if (scoreData.length == 0) {
		return res.render('./manage/audit/bymatch', {
			title: 'Match Scouting Audit',
			audit: null
		});
	}
	
	var lastMatchNum = scoreData[0].match_number;
	
	for(var i = 0; i < scoreData.length; i++){
		
		let thisMatchNum  = scoreData[i].match_number;
		
		//if we finished going through last match, go to next match and create a new array to push to audit
		if(thisMatchNum > lastMatchNum || i == 0){
			lastMatchNum = thisMatchNum;
			
			let matchTeamArr = [];
			
			//go through the next 6 elements in scoreData and add to matchTeamArr
			for(var j = 0; j < 6; j++){
				
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
	
	var eventKey = req.event.key;
	var org_key = req.user.org_key;
		
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matches = utilities.find('matches', {event_key: eventKey, 'alliances.red.score': -1}, {sort: {'time': 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	
	if (matches[0]){
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug('Comments audit: earliestTimestamp=' + earliestTimestamp);
		
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoreData = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': eventKey, 'time': { $lt: earliestTimestamp }}, { sort: {'actual_scorer': 1, 'time': 1, 'alliance': 1, 'team_key': 1} });
	
	var audit = [];
	
	for(var i in scoreData){
		if(scoreData[i].data && scoreData[i].data.otherNotes != ''){
			audit.push(scoreData[i]);
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

	var eventKey = req.event.key;
	var orgKey = req.user.org_key;

	var lookbackto = req.query.lookbackto;
	if (!lookbackto)
		lookbackto = '1';
	let lookbacktoIndex = parseInt(lookbackto) - 1;
	
	var matches = await utilities.find('matches',
		{ 'event_key': eventKey, 'match_number': { '$gt': lookbacktoIndex }, 'score_breakdown': { '$ne': null } }, { sort: { match_number: -1 } },
		{allowCache: true, maxCacheAge: 10}
	);

	// set up the return data table - we'll add alternating rows of FRC & scouting data
	let returnCompareTable = [];
	// dictionary of scouts - each item should be keyed by scout name and contain (a) total matches scouted + (b) total error point diffs & ratios	
	let scoutScoreDict = {};

	// cycle through match objects; for each one, cycle through 'red' and 'blue' array
	// for each alliance, pull scouting data - if less than 3 found, can't compare
	let allianceArray = ['red', 'blue'];
	for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
		let thisMatch = matches[matchIdx];
		for (let allianceIdx = 0; allianceIdx < allianceArray.length; allianceIdx++) {
			let thisAlliance = allianceArray[allianceIdx];
			console.log('thisAlliance=' + thisAlliance + ',thisMatch.key=' + thisMatch.key);

			// retrieve the scouting data for this match
			var matchScoutReports = await utilities.find('matchscouting',
				{ 'event_key': eventKey, 'match_key': thisMatch.key, 'data': { '$ne': null }, 'alliance': thisAlliance }, { sort: { actual_scorer: 1 } }
			);
			console.debug('matchScoutReports.length=' + matchScoutReports.length);
			// can't compare if we don't have three (3) scouting reports
			if (matchScoutReports.length != 3) {
				// TODO
			}
			else {
				let thisScoreBreakdown = thisMatch.score_breakdown[thisAlliance];
				let totalPoints = thisScoreBreakdown.totalPoints;
				let foulPoints = thisScoreBreakdown.foulPoints;
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
					orgTot += thisScoutReport.contributedPoints;
					orgAutoTot += thisScoutReport.autoPoints;
					orgTeleTot += thisScoutReport.teleopPoints;
					orgEndTot += thisScoutReport.climbPoints;
					orgTaxiTot += thisScoutReport.didTaxi;
					orgAutoLow += thisScoutReport.autoLowScored;
					orgAutoHigh += thisScoutReport.autoHighScored;
					orgTeleLow += thisScoutReport.teleopLowScored;
					orgTeleHigh += thisScoutReport.teleopHighScored;
				}

				// score
				let errDiff = Math.abs(orgTot - frcTot);
				let errRatio = errDiff / frcTot;
				if (errRatio > 1.0)
					errRatio = 1.0;

				// track scores
				for (let scoutIdx = 0; scoutIdx < matchScoutReports.length; scoutIdx++) {
					let thisScoutName = matchScoutReports[scoutIdx].actual_scorer;
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
				frcRow.push(thisScoreBreakdown.autoPoints);
				frcRow.push(thisScoreBreakdown.teleopPoints - thisScoreBreakdown.endgamePoints);
				frcRow.push(thisScoreBreakdown.endgamePoints);
				let frcTaxi = 0;
				for (let robotIdx = 1; robotIdx < 4; robotIdx++)
					if (thisScoreBreakdown['taxiRobot' + robotIdx] == 'Yes')
						frcTaxi++;
				frcRow.push(frcTaxi);
				frcRow.push(thisScoreBreakdown.autoCargoLowerBlue + thisScoreBreakdown.autoCargoLowerFar + thisScoreBreakdown.autoCargoLowerNear + thisScoreBreakdown.autoCargoLowerRed);
				frcRow.push(thisScoreBreakdown.autoCargoUpperBlue + thisScoreBreakdown.autoCargoUpperFar + thisScoreBreakdown.autoCargoUpperNear + thisScoreBreakdown.autoCargoUpperRed);
				frcRow.push(thisScoreBreakdown.teleopCargoLowerBlue + thisScoreBreakdown.teleopCargoLowerFar + thisScoreBreakdown.teleopCargoLowerNear + thisScoreBreakdown.teleopCargoLowerRed);
				frcRow.push(thisScoreBreakdown.teleopCargoUpperBlue + thisScoreBreakdown.teleopCargoUpperFar + thisScoreBreakdown.teleopCargoUpperNear + thisScoreBreakdown.teleopCargoUpperRed);

				let orgRow = [];
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
