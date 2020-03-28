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

	res.render('./manage/audit',{
		title: 'Scouter Audit',
		audit: memberArr
	});
}));

router.get('/uploads', wrap(async (req, res) => {
	
	var orgKey = req.user.org_key;
	
	var uploads = await utilities.find('uploads', 
		{org_key: orgKey, removed: false},
		{},
	);
	
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
	
	res.render('./manage/audituploads', {
		title: 'Uploads Audit',
		uploadsByTeam: uploadsByTeam
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
	
	res.render('./manage/auditbymatch', {
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
	
	res.render('./manage/auditcomments', {
		title: 'Scouter Comments Audit',
		'audit': audit
	});
}));


module.exports = router;
