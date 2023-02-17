import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import type { MongoDocument } from 'scoutradioz-utilities';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e, { assert } from 'scoutradioz-http-errors';
import type { Layout, LayoutEdit, MatchScouting, MatchFormData } from 'scoutradioz-types';
import type { DeleteResult, InsertManyResult } from 'mongodb';
import { getSubteamsAndClasses } from '../../helpers/orgconfig';
//import { write } from 'fs';

const router = express.Router();
const logger = getLogger('orgconfig');

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	const org = req._user.org;
	
	res.render('./manage/config/index', {
		title: `Configure ${org.nickname}`,
		org: org
	});
	
}));

router.post('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[post]');
	
	const orgKey = req.body.org_key;
	const nickname = req.body.nickname;
	
	assert(orgKey === req._user.org.org_key, new e.UnauthorizedError(`Unauthorized to edit org ${orgKey}`));
	
	logger.info(`Updating org ${orgKey}, nickname=${nickname}`);
	
	let subteams, classes;
	try {
		let ret = getSubteamsAndClasses(req.body);
		subteams = ret.subteams;
		classes = ret.classes;
	}
	catch (err) {
		return res.redirect(`/manage/config?alert=${err}&type=error`);
	}
	logger.debug(`subteams=${JSON.stringify(subteams)} classes=${JSON.stringify(classes)}`);
	
	//Create update query
	let updateQuery: MongoDocument = {
		$set: {
			nickname: nickname,
			'config.members.subteams': subteams,
			'config.members.classes': classes,
		},
	};
	
	logger.debug(`updateQuery=${JSON.stringify(updateQuery)}`);
	
	const writeResult = await utilities.update('orgs', 
		{org_key: orgKey}, updateQuery
	);
	
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	
	res.redirect('/manage/config?alert=Updated successfully.&type=good');
}));

router.post('/setdefaultpassword', wrap(async (req, res) => {
	
	let newDefaultPassword = req.body.defaultPassword;
	
	let hash = await bcrypt.hash(newDefaultPassword, 10);
	
	await utilities.update('orgs', {org_key: req._user.org_key}, {$set: {default_password: hash}});
	
	res.redirect(`/manage?alert=Successfully changed password to ${newDefaultPassword}.`);
	
}));

router.get('/editform', wrap(async (req, res) => {
	let thisFuncName = 'orgconfig.editform(root): ';

	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;

	let form_type = req.query.form_type;
	
	assert(form_type === 'matchscouting' || form_type === 'pitscouting', new e.UserError('Invalid form type'));

	let org_key = req._user.org_key;
	
	let yearStr = req.query.year || req.event.key;
	let year: number;
	if (typeof yearStr === 'string') year = parseInt(yearStr);
	else throw new e.UserError('Either "year" or "key" must be set.');
	
	// load form definition data from the database
	let layoutArray: Layout[] = await utilities.find('layout', {org_key: org_key, year: year, form_type: form_type}, {sort: {'order': 1}});
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
	let matchDataFind: MatchScouting[] = await utilities.find('matchscouting', {'org_key': org_key, 'year': year, 'data': {$ne: null}}, {});
	matchDataFind.forEach( (element) => {
		let thisMatch: MatchScouting = element;
		if (thisMatch['data']) {
			previousDataExists = true;
			let thisData: MatchFormData  = thisMatch['data'];
			let dataKeys = Object.keys(thisData);
			//logger.debug(`dataKeys=${JSON.stringify(dataKeys)}`);
			dataKeys.forEach(function (value) {
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
	
	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;
		
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
	let removeResult: DeleteResult = await utilities.remove('layout', {org_key: org_key, year: year, form_type: form_type});
	logger.info(`Removed ${removeResult.deletedCount} prior form records`);

	// 2. write in new/updated data
	let writeResult: InsertManyResult<MongoDocument> | undefined = await utilities.insert('layout', formdata);
	if (writeResult)
		logger.info(`Inserted ${writeResult.insertedCount} new form records`);
	else
		logger.warn('Inserted 0 new form records!');

	res.redirect('/manage');
}));
	
router.get('/pitsurvey', wrap(async (req, res) => {
	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;
		
	let org_key = req._user.org_key;
	
	let yearStr = req.query.year || req.event.key;
	let year: number;
	if (typeof yearStr === 'string') year = parseInt(yearStr);
	else throw new e.UserError('Either "year" or "key" must be set.');
	
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var pitlayout = await utilities.find("scoutinglayout", {org_key: req.user.org_key, year: year}, {sort: {"order": 1}})
	let pitlayout: Layout[] = await utilities.find('layout', {org_key: org_key, year: year, form_type: 'pitscouting'}, {sort: {'order': 1}});
	
	res.render('./manage/config/pitsurvey', {
		title: 'Pit Survey Layout',
		pitlayout: pitlayout,
		year: year
	});
	
}));

module.exports = router;