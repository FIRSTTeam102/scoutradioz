import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import { matchData as matchDataHelper, upload as uploadHelper } from 'scoutradioz-helpers';
import e from 'scoutradioz-http-errors';
import type { Layout, MatchFormData, MatchScouting, PitScouting, ScouterRecord, Team, User, SchemaItem, Schema, ScouterHistoryRecord } from 'scoutradioz-types';
import utilities from 'scoutradioz-utilities';
import wrap from '../helpers/express-async-handler';
import Permissions from '../helpers/permissions';

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

	const event_key = req.event.key;
	const year = req.event.year;
	let thisUser = req._user;
	let thisUserName = thisUser.name;
	let match_team_key = req.query.key;
	let alliance = String(req.query.alliance);
	const org_key = thisUser.org_key;
	if (typeof match_team_key !== 'string') throw new e.UserError(req.msg('scouting.invalidMatchKey')); // 2022-05-17 JL: Throw if they don't have a match key set in the url OR if they set two, making it an array
	let teamKey = match_team_key.split('_')[2];
	// 2024-02-29, M.O'C: special case, we're going to handle "frc999999" for form demo purposes
	const demoTeamKey = 'frc999999';

	logger.debug(`match_team_key: ${match_team_key} alliance: ${alliance} user: ${thisUserName} teamKey=${teamKey}`);
	
	if (!match_team_key) {
		res.redirect('/dashboard');
		return;
	}
	
	//check if there is already data for this match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let assignment = await utilities.findOne('matchscouting', {org_key, year, match_team_key}, {});
		
	//scouting answers for this match are initialized as null for visibility
	let answers: MatchFormData|null = null;
	
	if( assignment ){
		
		alliance = assignment.alliance; // 2024-04-06 JL: Pull alliance from matchscouting entry if possible to not rely on url
		//if we have data for this match, 
		let data = assignment.data;
		if(data){
			logger.debug(`data: ${JSON.stringify(data)}`);
			//set answers to data if exists
			answers = data;
		}
		else{
			logger.debug('no data for this match');
		}
	}
	
	//load layout/schema
	let schema = await matchDataHelper.getSchemaForOrgAndEvent(org_key, event_key, 'matchscouting');

	let groupedLayout = splitLayoutIntoGroups(schema.layout);
	
	const images = await uploadHelper.findTeamImages(org_key, year, teamKey);
	const orgImages = await uploadHelper.findOrgImages(org_key, year);

	let team: Team = await utilities.findOne('teams', {key: teamKey}, {}, {allowCache: true});
	
	// 2024-02-29, M.O'C: if the teamKey is the same as the demoTeamKey, set the 'team' 
	if (teamKey == demoTeamKey)
		team = {
			address: null,
			city: 'DN', 
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
			state_prov: 'GN',
			team_number: 999999,
			website: null
		};

	if (!team) throw new e.UserError(req.msg('scouting.invalidTeam', {team: teamKey}));

	let allianceLocale = (alliance.toLowerCase().startsWith('b')) ? req.msg('alliance.blueShort') : req.msg('alliance.redShort');
	let matchNumber = assignment?.match_number || match_team_key.split('_')[1]?.substring(2); // In case the matchscouting assignment isn't in the db
	let title = `#${matchNumber} - ${teamKey.substring(3)} ${allianceLocale} | ${req.msg('scouting.match')}`;

	// 2024-02-05, M.O'C: Add super-scout pit text to page
	let pitFind = await utilities.findOne('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : teamKey }, {});
	let pit_super_data: StringDict|null = null;
	if (pitFind && pitFind.super_data) pit_super_data = pitFind.super_data;
	logger.debug(`pit_super_data=${JSON.stringify(pit_super_data)}`);

	//render page
	res.render('./scouting/match', {
		title: title,
		groupedLayout,
		key: match_team_key,
		alliance,
		answers,
		teamKey,
		images,
		orgImages,
		team,
		pit_super_data,
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
		city: 'DN', 
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
		state_prov: 'GN',
		team_number: 999999,
		website: null
	};

	const image_year = req.event.year;
	const orgImages = await uploadHelper.findOrgImages(org_key, image_year);

	//render page
	if (form_type == 'matchscouting') {
		// @ts-ignore FIX BEFORE COMMITTING
		let groupedLayout = splitLayoutIntoGroups(layout);
		res.render('./scouting/match', {
			title: req.msg('scouting.match'),
			layout,
			groupedLayout,
			key: match_team_key,
			alliance,
			answers: null,
			teamKey: 'frc999999',
			images: null,
			team,
			orgImages
		});
	}
	else
		res.render('./scouting/pit', {
			title: req.msg('scouting.pit'),
			layout,
			pitData: null, 
			key: 'frc999999',
			uploadURL: null,
			teamKey: 'frc999999',
			images: null,
			team,
			orgImages
		});
}));

router.post('/match/submit', wrap(async (req, res) => {
	logger.addContext('funcName', 'match/submit[post]');
	logger.info('ENTER');
	
	let thisScouterRecord: ScouterRecord;
	
	if(req.user && req.user.name)
		thisScouterRecord = {
			name: req.user.name,
			id: req.user._id
		};
	else
		thisScouterRecord = { 
			name: 'Mr. Unknown', 
			id: -1, 
		};
	
	let matchData = req.body;
	if(!matchData)
		return res.send({status: 500, message: req.msg('scouting.noDataSubmit', {url: '/scouting/match/submit'})});
	
	const event_key = req.event.key;
	let event_year = req.event.year;
	let match_team_key = matchData.match_team_key;
	let org_key = req._user.org_key; // JL note: this probably throws an error if the user is not logged in

	logger.debug('match_key=' + match_team_key + ' ~ thisUserName=' + thisScouterRecord.name);
	delete matchData.match_key;
	logger.debug('matchData(pre-modified)=' + JSON.stringify(matchData));
	//logger.debug('match_key=' + match_key + ' ~ thisUserName=' + thisUserName);
	//logger.debug('matchData=' + JSON.stringify(matchData));

	// Get the layout so we know types of data elements
	let schema = await matchDataHelper.getSchemaForOrgAndEvent(org_key, event_key, 'matchscouting');

	let layoutTypeById: StringDict = {};
	logger.trace('layout=', schema.layout);
	for (let item of schema.layout) {
		// filter for layout items with an id
		if ('id' in item) {
			logger.trace(item.id + ' is a ' + item.type);
			layoutTypeById[item.id] = item.type;
		}
	}

	// Process input data, convert to numeric values
	for (let property in matchData) {
		if (layoutTypeById.hasOwnProperty(property)) {
			let thisType = layoutTypeById[property];
			// 2022-03-22 JL: Moving the data-type parsing into a helper function, which can easily be updated later as more form types are added
			matchData[property] = matchDataHelper.fixDatumType(matchData[property], thisType);
		}
	}
	logger.debug('matchData(UPDATED:1)=' + JSON.stringify(matchData));

	// 2022-02-22, JL: Moved dervied metric calculations into matchDataHelper
	let { matchData: matchDataNew } = await matchDataHelper.calculateDerivedMetrics(org_key, event_year, matchData);
	matchData = matchDataNew; // JL: this is temporary while we have debugging info
	logger.debug('matchData(UPDATED:2)=' + JSON.stringify(matchData));

	// Post modified data to DB
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.update('matchscouting', { 
		org_key, 
		match_team_key 
	}, { 
		$set: { data: matchData, 
			actual_scorer: thisScouterRecord, 
			useragent: req.shortagent 
		} 
	});

	// Simply to check if the user is assigned (2022-03-24 JL)
	const oneAssignedMatch: MatchScouting = await utilities.findOne('matchscouting', {
		org_key, 
		event_key: req.event.key, 
		'assigned_scorer.id': thisScouterRecord.id
	});
	let assigned = !!oneAssignedMatch;
	
	return res.send({message: req.msg('scouting.submitSuccess'), status: 200, assigned});
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
	// 2024-02-29, M.O'C: special case, we're going to handle "frc999999" for form demo purposes
	const demoTeamKey = 'frc999999';
	
	if (typeof teamKey !== 'string') throw new e.UserError(req.msg('scouting.invalidTeamKey'));
	
	const schema = await matchDataHelper.getSchemaForOrgAndEvent(org_key, event_key, 'pitscouting');
	
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	let pitFind: PitScouting[] = await utilities.find('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : teamKey }, {});
	let pitData: StringDict|null = null;
	if (pitFind && pitFind[0])
		if (pitFind[0].data)
			pitData = pitFind[0].data;
			
	const images = await uploadHelper.findTeamImages(org_key, event_year, teamKey);
	const orgImages = await uploadHelper.findOrgImages(org_key, event_year);
	
	let team: Team = await utilities.findOne('teams', {key: teamKey}, {}, {allowCache: true});
	// 2024-02-29, M.O'C: if the teamKey is the same as the demoTeamKey, set the 'team' 
	if (teamKey == demoTeamKey)
		team = {
			address: null,
			city: 'DN', 
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
			state_prov: 'GN',
			team_number: 999999,
			website: null
		};
	
	res.render('./scouting/pit', {
		title: req.msg('scouting.pit'),
		layout: schema.layout,
		pitData, 
		key: teamKey,
		uploadURL,
		teamKey,
		images,
		orgImages,
		team,
	});
}));

router.post('/pit/submit', wrap(async (req, res) => {
	logger.addContext('funcName', 'pit/submit[post]');
	logger.info('ENTER');

	let thisUser = req._user;
	let thisUserName = thisUser.name;

	let pitData = req.body;
	let team_key = pitData.teamkey;
	delete pitData.teamkey;
	logger.debug('teamKey=' + team_key + ' ~ thisUserName=' + thisUserName);
	logger.debug('pitData=' + JSON.stringify(pitData));

	let event_key = req.event.key;
	let org_key = thisUser.org_key;
	
	let existingPitEntry = await utilities.findOne('pitscouting', {org_key, event_key, team_key});
	// Ensure pit scouting entry exists in db
	if (!existingPitEntry) return res.status(404).send({ message: `A pit scouting assignment was not found for ${org_key}, ${event_key}, ${team_key}` });

	// Correct data based on the type in the layout
	let correctedData: MatchFormData = {}; // JL todo: add PitFormData type?
	const { layout } = await matchDataHelper.getSchemaForOrgAndEvent(org_key, event_key, 'pitscouting');
	for (let item of layout) {
		switch (item.type) {
			case 'checkbox':
			case 'counter':
			case 'slider':
				correctedData[item.id] = matchDataHelper.fixDatumType(pitData[item.id], item.type);
				break;
			case 'textblock':
			case 'multiselect':
				correctedData[item.id] = pitData[item.id];
				break;
		}
	}

	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key,
	await utilities.update(
		'pitscouting',
		{ org_key, event_key, team_key },
		{
			$set: {
				data: correctedData,
				actual_scouter: {
					id: thisUser._id,
					name: thisUserName
				},
				useragent: req.shortagent,
				history: getNewSubmissionHistory(existingPitEntry, thisUser._id, thisUserName)
			},
		}
	);

	return res.status(200).send({ message: req.msg('scouting.submitSuccess')});
}));

router.get('/', wrap(async (req, res) => {
	
	//redirect to pits dashboard
	res.redirect('/dashboard/pits');
}));

//
// Super-scout functions
//

// TODOSUPER: Replace TEAM_ADMIN permission check with SUPER_SCOUT
router.get('/supermatch*', wrap(async (req, res) => {
	if (!await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		return;
	}
	logger.addContext('funcName', 'supermatch[get]');
	logger.info('ENTER');

	let eventYear = req.event.year;
	let thisUser = req._user;
	let thisUserName = thisUser.name;
	let match_key = req.query.key;
	let org_key = thisUser.org_key;
	if (typeof match_key !== 'string') throw new e.UserError(req.msg('scouting.invalidMatchKey'));
	
	logger.debug(`match_key: ${match_key} user: ${thisUserName}`);
	
	if (!match_key) {
		res.redirect('/dashboard');
		return;
	}
	
	// check if there is already data for this match
	let superdata: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'year' : eventYear, 'match_key': match_key}, {sort: {'alliance': -1, 'team_key': 1}});
	// make a quick map of team_key: data
	let answers_map: { [key: string]: MatchFormData } = {};
	if ( superdata && superdata[0] ) 
		for (let thisdata of superdata) 
			if (thisdata.super_data)
				answers_map[thisdata.team_key] = thisdata.super_data;

	let title = `#${superdata[0]?.match_number}`;
	let layout = null;  // POSSIBLE FUTURE EXPANSION

	//render page
	res.render('./scouting/supermatch', {
		title: title,
		layout,
		key: match_key,
		answers_map,
		superdata,
	});
}));

router.post('/match/supersubmit', wrap(async (req, res) => {
	logger.addContext('funcName', 'match/supersubmit[post]');
	logger.info('ENTER');

	let eventYear = req.event.year;
	let thisUser = req._user;
	let thisUserName = thisUser.name;

	let matchData = req.body;
	//let teamKey =  matchData.teamkey;
	//delete pitData.teamkey;
	logger.debug('thisUserName=' + thisUserName + '|matchData=' + JSON.stringify(matchData));

	let match_key = matchData['match_key'];

	let event_key = req.event.key;
	let org_key = thisUser.org_key;

	let superdata: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'year' : eventYear, 'match_key': match_key}, {sort: {'alliance': -1, 'team_key': 1}});

	if ( superdata && superdata[0] ) 
		for (let thisdata of superdata) {
			let match_team_key = thisdata.match_team_key;
			let team_key = thisdata.team_key;

			let super_data_blob: MatchFormData = {};
			for (let key in matchData) {
				let key_team = key.substring(0, key.indexOf('_'));
				let this_value = matchData[key];
				if (this_value && this_value !== '')
					if (key_team == team_key) {
						let key_id = key.substring(key.indexOf('_') + 1);
						//logger.debug('key_team=' + key_team + '|key_id=' + key_id + '|this_value=' + this_value);
						super_data_blob[key_id] = this_value;
					}
			}
			logger.trace('team_key=' + team_key + '|superdata_blob=' + JSON.stringify(super_data_blob));

			// only update if there was data to update
			if (Object.keys(super_data_blob).length !== 0)
				await utilities.update('matchscouting', { 
					org_key, 
					match_team_key 
				}, { 
					$set: { super_data: super_data_blob
					} 
				});
		}

	//redirect to pits dashboard
	res.redirect('/dashboard/matches');
}));

// TODOSUPER: Replace TEAM_ADMIN permission check with SUPER_SCOUT
router.get('/superpit*', wrap(async (req, res) => {
	if (!await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		return;
	}
	logger.addContext('funcName', 'superpit[get]');
	logger.info('ENTER');

	let event_key = req.event.key;
	let thisUser = req._user;
	let thisUserName = thisUser.name;
	let team_key = req.query.key;
	let event_year = req.event.year;
	let org_key = thisUser.org_key;
	if (typeof team_key !== 'string') throw new e.UserError(req.msg('scouting.invalidTeamKey'));
	
	logger.debug(`team_key: ${team_key} user: ${thisUserName}`);
	
	if (!team_key) {
		res.redirect('/dashboard');
		return;
	}
	
	let pitFind: PitScouting[] = await utilities.find('pitscouting', { 'org_key': org_key, 'event_key' : event_key, 'team_key' : team_key }, {});
	let pitData: StringDict|null = null;
	if (pitFind && pitFind[0])
		if (pitFind[0].super_data)
			pitData = pitFind[0].super_data;
	logger.trace(`pitData=${JSON.stringify(pitData)}`);

	const team: Team = await utilities.findOne('teams', {key: team_key}, {}, {allowCache: true});

	let title = `Super Scouting for Team ${team_key}`;
	let layout = null;  // POSSIBLE FUTURE EXPANSION

	//render page
	res.render('./scouting/superpit', {
		team,
		event_year,
		title: title,
		layout,
		key: team_key,
		pitData
	});
}));

// TODOSUPER: Replace TEAM_ADMIN permission check with SUPER_SCOUT
router.post('/pit/supersubmit', wrap(async (req, res) => {
	if (!await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		return;
	}
	logger.addContext('funcName', 'match/supersubmit[post]');
	logger.info('ENTER');

	let thisUser = req._user;
	let thisUserName = thisUser.name;

	let pitData = req.body;
	let teamKey = pitData.teamkey;
	logger.debug('teamKey=' + teamKey + '|thisUserName=' + thisUserName + '|pitData=' + JSON.stringify(pitData));

	let event_key = req.event.key;
	let org_key = thisUser.org_key;

	await utilities.update(
		'pitscouting',
		{ org_key, event_key, team_key: teamKey },
		{
			$set: {
				super_data: pitData
			},
		}
	);

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
		
		let entry: MatchScouting = await utilities.findOne('matchscouting', {org_key, match_team_key});
		if (entry) {
			if (entry.data)
				logger.info(`Previous data: ${JSON.stringify(entry.data)}`);
			else 
				logger.info('Data not present in DB anyways.');
			
			let writeResult = await utilities.update('matchscouting', 
				{org_key, match_team_key},
				{$set: {data: undefined}}
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

// Split the layout into groups, based on the header, making it easier to do the dynamic scrolling
function splitLayoutIntoGroups(layout: SchemaItem[]) {

	let groupedLayout = layout.reduce((list, current) => {
		if (current.type === 'header') {
			list.push({
				label: current.label || 'unknown',
				items: [current]
			});
		}
		else {
			let idx = list.length - 1;
			list[idx].items.push(current);
		}
		return list;
	}, [{label: 'Unknown', items: []}] as Array<{label: string, items: SchemaItem[]}>);
	return groupedLayout;
}

// TAKEN FROM VOYAGER/SRC/LIB/UTILS.TS
// IF THIS FUNCTION CHANGES, CHANGE IT IN THAT PLACE TOO
export function getNewSubmissionHistory<T extends {history?: ScouterHistoryRecord[]}>(assignment: T, user_id: number, user_name: string) {
	let newRecord: ScouterHistoryRecord = {
		id: user_id,
		name: user_name,
		time: new Date(),
	};

	if (!assignment.history) return [newRecord]; // If there's no history, we don't need to do any shenanigans

	let history = [...assignment.history]; // Create a clone of the original history object
	let lastEntry = history[history.length - 1];
	// If this is an edit by the same person who made the last change, then replace the record
	if (lastEntry.id === user_id) {
		history[history.length - 1] = newRecord;
	}
	// if the last edit was done by someone else, then add a new entry to the stack
	else {
		history.push(newRecord);
	}
	return history;
}

module.exports = router;