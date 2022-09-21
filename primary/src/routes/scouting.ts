import express from 'express';
import { getLogger } from 'log4js';
import bcrypt from 'bcryptjs';
import wrap from '../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../helpers/permissions';
import { upload as uploadHelper, matchData as matchDataHelper } from '@firstteam102/scoutradioz-helpers';
import e from '@firstteam102/http-errors';
import type { MatchScouting, Team, Layout, PitScouting, User } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('scouting');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require scouter-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_SCOUTER)) {
		next();
	}
}));

router.get('/match*', wrap(async (req, res) => {
	logger.addContext('funcName', 'match[get]');
	logger.info('ENTER');

	let eventYear = req.event.year;
	let thisUser = req._user;
	let thisUserName = thisUser.name;
	let match_team_key = req.query.key;
	let alliance = req.query.alliance;
	let org_key = thisUser.org_key;
	if (typeof match_team_key !== 'string') throw new e.UserError(req.msg('scouting.invalidMatchKey')); // 2022-05-17 JL: Throw if they don't have a match key set in the url OR if they set two, making it an array
	let teamKey = match_team_key.split('_')[2];
	
	logger.debug(`match_team_key: ${match_team_key} alliance: ${alliance} user: ${thisUserName} teamKey=${teamKey}`);
	
	if (!match_team_key) {
		res.redirect('/dashboard');
		return;
	}
	
	//check if there is already data for this match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scoringdata: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'year' : eventYear, 'match_team_key': match_team_key}, {sort: {'order': 1}});
		
	//scouting answers for this match are initialized as null for visibility
	let answers = null;
	
	if( scoringdata && scoringdata[0] ){
		
		//if we have data for this match, 
		let data = scoringdata[0].data;
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
	let layout: Layout[] = await utilities.find('layout', 
		{org_key: org_key, year: eventYear, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	
	
	const images = await uploadHelper.findTeamImages(org_key, eventYear, teamKey);
	const team: Team = await utilities.findOne('teams', {key: teamKey}, {}, {allowCache: true});
	
	if (!team) throw new e.UserError(req.msg('scouting.invalidTeam', {team: teamKey}));

	//render page
	res.render('./scouting/match', {
		title: req.msg('scouting.match'),
		layout: layout,
		key: match_team_key,
		alliance: alliance,
		answers: answers,
		teamKey: teamKey,
		images: images,
		team: team,
	});
}));

router.post('/testform', wrap(async (req, res) => {
	logger.addContext('funcName', 'testform[get]');
	logger.info('ENTER');

	let thisUser = req._user;
	let match_team_key = '2022dngn_qm99_frc999999';
	let alliance = 'blue';
	let org_key = thisUser.org_key;

	let jsonString = req.body.testData;
	logger.debug('jsonString=' + jsonString);
	let year = req.body.year;
	logger.debug('year=' + year);
	let form_type = req.body.form_type;
	logger.debug('form_type=' + form_type);

	let layout: Layout[] = JSON.parse(jsonString);
	layout.forEach( (element) => {
		// just in case the submission has '_id' attributes, remove them
		delete element['_id'];
		// write (or override existing) attributes
		element['form_type'] = form_type;
		element['org_key'] = org_key;
		element['year'] = year;
	});

	let team: Team = {
		address: null,
		city: null, 
		country: null,
		gmaps_place_id: null,
		gmaps_url: null,
		key: 'frc999999',
		lat: null,
		lng: null,
		location_name: null,
		motto: null,
		name: 'DNGN999999',
		nickname: 'DNGN999999',
		postal_code: null,
		rookie_year: null,
		school_name: null,
		state_prov: 'DNGN',
		team_number: 999999,
		website: null
	};

	if (form_type == 'matchscouting')
		//render page
		res.render('./scouting/match', {
			title: req.msg('scouting.match'),
			layout: layout,
			key: match_team_key,
			alliance: alliance,
			answers: null,
			teamKey: 'frc999999',
			images: null,
			team: team,
		});
	else
		res.render('./scouting/pit', {
			title: req.msg('scouting.pit'),
			layout: layout,
			pitData: null, 
			key: 'frc999999',
			uploadURL: null,
			teamKey: 'frc999999',
			images: null,
			team: team,
		});
}));

router.post('/match/submit', wrap(async (req, res) => {
	logger.addContext('funcName', 'match/submit[post]');
	logger.info('ENTER');
	
	let thisUser, thisUserName;
	
	if(req.user && req.user.name){
		thisUser = req.user;
		thisUserName = thisUser.name;
	}
	else{
		thisUser = { name: 'Mr. Unknown' };
		thisUserName = 'Mr. Unknown';
	}
	let matchData = req.body;
	if(!matchData)
		return res.send({status: 500, message: req.msg('scouting.noDataSubmit', {url: '/scouting/match/submit'})});
	
	let event_year = req.event.year;
	let match_team_key = matchData.match_team_key;
	let org_key = req._user.org_key;

	logger.debug('match_key=' + match_team_key + ' ~ thisUserName=' + thisUserName);
	delete matchData.match_key;
	logger.debug('matchData(pre-modified)=' + JSON.stringify(matchData));
	//logger.debug('match_key=' + match_key + ' ~ thisUserName=' + thisUserName);
	//logger.debug('matchData=' + JSON.stringify(matchData));

	// Get the 'layout' so we know types of data elements

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	let layout: Layout[] = await utilities.find('layout',
		{org_key: org_key, year: event_year, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	let layoutTypeById: StringDict = {};
	logger.debug('layout=' + JSON.stringify(layout));
	for (let property in layout) {
		if (layout.hasOwnProperty(property)) {
			let thisLayoutItem = layout[property];
			if (typeof thisLayoutItem.id === 'string') {
				logger.debug(thisLayoutItem.id + ' is a ' + thisLayoutItem.type);
				layoutTypeById[thisLayoutItem.id] = thisLayoutItem.type;
			}
		}
	}

	// Process input data, convert to numeric values
	for (let property in matchData) {
		if (layoutTypeById.hasOwnProperty(property)) {
			let thisType = layoutTypeById[property];
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
	const oneAssignedMatch: MatchScouting = await utilities.findOne('matchscouting', {
		org_key: org_key, 
		event_key: req.event.key, 
		assigned_scorer: thisUserName
	});
	let assigned = !!oneAssignedMatch;
	
	return res.send({message: req.msg('scouting.submitSuccess'), status: 200, assigned: assigned});
}));

router.get('/pit*', wrap(async (req, res) => {
	logger.addContext('funcName', 'pit[get]');
	logger.info('ENTER');
	
	let uploadURL = process.env.UPLOAD_URL + '/' + process.env.TIER + '/image';
	
	//Add event key and pit data to get pit function
	let event_key = req.event.key;
	let event_year = req.event.year;
	let org_key = req._user.org_key;

	let teamKey = req.query.team_key;
	
	if (typeof teamKey !== 'string') throw new e.UserError(req.msg('scouting.invalidTeamKey'));
		
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var layout = await utilities.find("scoutinglayout", { "year": event_year }, {sort: {"order": 1}});
	let layout: Layout[] = await utilities.find('layout', 
		{org_key: org_key, year: event_year, form_type: 'pitscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	let pitFind: PitScouting[] = await utilities.find('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : teamKey }, {});
	let pitData = null;
	if (pitFind && pitFind[0])
		if (pitFind[0].data)
			pitData = pitFind[0].data;
			
	const images = await uploadHelper.findTeamImages(org_key, event_year, teamKey);
	
	const team: Team = await utilities.findOne('teams', {key: teamKey}, {}, {allowCache: true});
	
	res.render('./scouting/pit', {
		title: req.msg('scouting.pit'),
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
	
	let thisUser = req._user;
	let thisUserName = thisUser.name;
	
	let pitData = req.body;
	let teamKey = pitData.teamkey;
	delete pitData.teamkey;
	logger.debug('teamKey=' + teamKey + ' ~ thisUserName=' + thisUserName);
	logger.debug('pitData=' + JSON.stringify(pitData));

	let event_key = req.event.key;
	let org_key = thisUser.org_key;

	// TODO: Verify pit data against layout, to avoid malicious/bogus data inserted into db?

	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	await utilities.update('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : teamKey }, { $set: { 'data' : pitData, 'actual_scouter': thisUserName, useragent: req.shortagent } });

	return res.send({message: req.msg('scouting.submitSuccess'), status: 200});
}));

router.get('/', wrap(async (req, res) => {
	
	//redirect to pits dashboard
	res.redirect('/dashboard/pits');
}));

// (Org manager only) - Deletes the scouting data from a given match. Requires a password.
router.post('/match/delete-data', wrap(async (req, res) => {
	if (!await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		return;
	}
	logger.addContext('funcName', 'match/delete-data[post]');
	
	const password = req.body.password;
	const match_team_key = req.body.match_team_key;
	const thisUser = req._user;
	const org_key = thisUser.org_key;
	
	const user: User = await utilities.findOne('users', {_id: thisUser._id});
	
	logger.info(`User ${thisUser.name} is requesting to delete scouting data for match ${match_team_key}!`);
	
	const comparison = await bcrypt.compare(password, user.password);
	
	if (comparison === true) {
		
		let entry: MatchScouting = await utilities.findOne('matchscouting', {org_key: org_key, match_team_key: match_team_key});
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
				message: req.msg('scouting.deleteSuccess')
			});
		}
		else {
			logger.info('Entry not found in database!');
			res.send({
				success: false,
				message: req.msg('scouting.invalidMatchKey')
			});
		}
	}
	else {
		logger.info('Authentication failed');
		res.send({
			success: false,
			message: req.msg('user.incorrectpassword')
		});
	}
}));

module.exports = router;