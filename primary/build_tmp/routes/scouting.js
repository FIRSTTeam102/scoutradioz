const router = require('express').Router();
const logger = require('log4js').getLogger('scouting');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const {upload: uploadHelper, matchData: matchDataHelper} = require('@firstteam102/scoutradioz-helpers');
const e = require('@firstteam102/http-errors');
const bcrypt = require('bcryptjs');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require scouter-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_SCOUTER)) {
		next();
	}
}));

router.get('/match*', wrap(async (req, res) => {
	logger.addContext('funcName', 'match[get]');
	logger.info('ENTER');

	var eventYear = req.event.year;
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	var match_team_key = req.query.key;
	var alliance = req.query.alliance;
	var org_key = req.user.org_key;
	if (!match_team_key) return res.redirect('/dashboard?alert=No match key was set for scouting.'); // 2022-03-06 JL: Redirect user if they don't have a match key set in the url
	var teamKey = match_team_key.split('_')[2];
	
	logger.debug(`match_team_key: ${match_team_key} alliance: ${alliance} user: ${thisUserName} teamKey=${teamKey}`);
	
	if (!match_team_key) {
		res.redirect('/dashboard');
		return;
	}
	
	//check if there is already data for this match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoringdata = await utilities.find('matchscouting', {'org_key': org_key, 'year' : eventYear, 'match_team_key': match_team_key}, {sort: {'order': 1}});
		
	//scouting answers for this match are initialized as null for visibility
	var answers = null;
	
	if( scoringdata && scoringdata[0] ){
		
		//if we have data for this match, 
		var data = scoringdata[0].data;
		if(data){
			logger.debug(`data: ${JSON.stringify(scoringdata[0].data)}`);
			//set answers to data if exists
			answers = data;
		}
		else{
			logger.debug('no data for this match');
		}
	}
	
	//load layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var layout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find('layout', 
		{org_key: org_key, year: parseInt(eventYear), form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	
	
	const images = await uploadHelper.findTeamImages(org_key, eventYear, teamKey);
	
	const team = await utilities.findOne('teams', {key: teamKey}, {}, {allowCache: true});

	//render page
	res.render('./scouting/match', {
		title: 'Match Scouting',
		layout: layout,
		key: match_team_key,
		alliance: alliance,
		answers: answers,
		teamKey: teamKey,
		images: images,
		team: team,
	});
}));

router.post('/match/submit', wrap(async (req, res) => {
	logger.addContext('funcName', 'match/submit[post]');
	logger.info('ENTER');
	
	var thisUser, thisUserName;
	
	if(req.user && req.user.name){
		thisUser = req.user;
		thisUserName = thisUser.name;
	}
	else{
		thisUser = { name: 'Mr. Unknown' };
		thisUserName = 'Mr. Unknown';
	}
	var matchData = req.body;
	if(!matchData)
		return res.send({status: 500, message: 'No data was sent to /scouting/match/submit.'});
	
	var event_year = req.event.year;
	var match_team_key = matchData.match_team_key;
	var org_key = req.user.org_key;

	logger.debug('match_key=' + match_team_key + ' ~ thisUserName=' + thisUserName);
	delete matchData.match_key;
	logger.debug('matchData(pre-modified)=' + JSON.stringify(matchData));
	//logger.debug('match_key=' + match_key + ' ~ thisUserName=' + thisUserName);
	//logger.debug('matchData=' + JSON.stringify(matchData));

	// Get the 'layout' so we know types of data elements

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	var layout = await utilities.find('layout', 
		{org_key: org_key, year: parseInt(event_year), form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	var layoutTypeById = {};
	//logger.debug("layout=" + JSON.stringify(layout));
	for (let property in layout) {
		if (layout.hasOwnProperty(property)) {
			//logger.debug(layout[property].id + " is a " + layout[property].type);
			layoutTypeById[layout[property].id] = layout[property].type;
		}
	}

	// Process input data, convert to numeric values
	for (let property in matchData) {
		if (layoutTypeById.hasOwnProperty(property)) {
			var thisType = layoutTypeById[property];
			// 2022-03-22 JL: Moving the data-type parsing into a helper function, which can easily be updated later as more form types are added
			matchData[property] = matchDataHelper.fixDatumType(matchData[property], thisType);
			/*
			//logger.debug(property + " :: " + matchData[property] + " ~ is a " + thisType);
			if ('counter' == thisType || 'badcounter' == thisType) {
				//logger.debug("...converting " + matchData[property] + " to a number");
				let newVal = -1;
				if (matchData[property]) {
					var parseVal = parseInt(matchData[property]);
					if (!isNaN(parseVal))
						newVal = parseVal;
				}
				matchData[property] = newVal;
			}
			if ('checkbox' == thisType) {
				//logger.debug("...converting " + matchData[property] + " to a boolean 1/0 number");
				let newVal = (matchData[property] == 'true' || matchData[property] == true) ? 1 : 0;
				matchData[property] = newVal;
			}
			*/
		}
	}
	logger.debug('matchData(UPDATED:1)=' + JSON.stringify(matchData));

	// 2022-02-22, JL: Moved dervied metric calculations into matchDataHelper
	matchData = await matchDataHelper.calculateDerivedMetrics(org_key, event_year, matchData);
	logger.debug('matchData(UPDATED:2)=' + JSON.stringify(matchData));

	// Post modified data to DB
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.update('matchscouting', { 'org_key': org_key, 'match_team_key' : match_team_key }, { $set: { 'data' : matchData, 'actual_scorer': thisUserName, useragent: req.shortagent } });

	// Simply to check if the user is assigned (2022-03-24 JL)
	const oneAssignedMatch = await utilities.findOne('matchscouting', {
		org_key: org_key, 
		event_key: req.event.key, 
		assigned_scorer: thisUserName
	});
	var assigned = !!oneAssignedMatch;
	
	return res.send({message: 'Submitted data successfully.', status: 200, assigned: assigned});
}));

router.get('/pit*', wrap(async (req, res) => {
	logger.addContext('funcName', 'pit[get]');
	logger.info('ENTER');
	
	var uploadURL = process.env.UPLOAD_URL + '/' + process.env.TIER + '/image';
	
	//Add event key and pit data to get pit function
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;

	var teamKey = req.query.team_key;
	if (!teamKey) {
		throw new e.UserError('Team key is not defined.');
	}
	
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var layout = await utilities.find("scoutinglayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find('layout', 
		{org_key: org_key, year: event_year, form_type: 'pitscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var pitFind = await utilities.find('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : teamKey }, {});
	var pitData = null;
	if (pitFind && pitFind[0])
		if (pitFind[0].data)
			pitData = pitFind[0].data;
	
	const images = await uploadHelper.findTeamImages(org_key, event_year, teamKey);
	
	const team = await utilities.findOne('teams', {key: teamKey}, {}, {allowCache: true});
	
	res.render('./scouting/pit', {
		title: 'Pit Scouting',
		layout: layout,
		pitData: pitData, 
		key: teamKey,
		uploadURL: uploadURL,
		teamKey: teamKey,
		images: images,
		team: team,
	});
}));

router.post('/pit/submit', wrap(async (req, res) => {
	logger.addContext('funcName', 'pit/submit[post]');
	logger.info('ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	
	var pitData = req.body;
	var teamKey = pitData.teamkey;
	delete pitData.teamkey;
	logger.debug('teamKey=' + teamKey + ' ~ thisUserName=' + thisUserName);
	logger.debug('pitData=' + JSON.stringify(pitData));

	var event_key = req.event.key;
	var org_key = req.user.org_key;

	// TODO: Verify pit data against layout, to avoid malicious/bogus data inserted into db?

	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	await utilities.update('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : teamKey }, { $set: { 'data' : pitData, 'actual_scouter': thisUserName, useragent: req.shortagent } });

	return res.send({message: 'Submitted data successfully.', status: 200});
}));

router.get('/', wrap(async (req, res) => {
	
	//redirect to pits dashboard
	res.redirect('/dashboard/pits');
}));

// (Org manager only) - Deletes the scouting data from a given match. Requires a password.
router.post('/match/delete-data', wrap(async (req, res) => {
	if (!await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		return;
	}
	logger.addContext('funcName', 'match/delete-data[post]');
	
	const password = req.body.password;
	const match_team_key = req.body.match_team_key;
	const org_key = req.user.org_key;
	
	const user = await utilities.findOne('users', {_id: req.user._id});
	
	logger.info(`User ${req.user.name} is requesting to delete scouting data for match ${match_team_key}!`);
	
	const comparison = await bcrypt.compare(password, user.password);
	
	if (comparison === true) {
		
		let entry = await utilities.findOne('matchscouting', {org_key: org_key, match_team_key: match_team_key});
		if (entry) {
			if (entry.data)
				logger.info(`Previous data: ${JSON.stringify(entry.data)}`);
			else 
				logger.info('Data not present in DB anyways.');
			
			let writeResult = await utilities.update('matchscouting', 
				{org_key: org_key, match_team_key: match_team_key},
				{$set: {data: null}}
			);
			
			logger.debug(`Done; writeResult=${JSON.stringify(writeResult)}`);
			res.send({
				success: true,
				message: 'Deleted data successfully. You will not be redirected away from the page, in case you wish to re-submit the data on screen.'
			});
		}
		else {
			logger.info('Entry not found in database!');
			res.send({
				success: false,
				message: 'Invalid match requested.'
			});
		}
	}
	else {
		logger.info('Authentication failed');
		res.send({
			success: false,
			message: 'Password incorrect.'
		});
	}
}));

module.exports = router;