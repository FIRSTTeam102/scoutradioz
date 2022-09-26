import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e from '@firstteam102/http-errors';
import type { Layout, LayoutEdit } from '@firstteam102/scoutradioz-types';
import { DeleteResult, InsertManyResult } from 'mongodb';
import { write } from 'fs';

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
	
	res.redirect('/manage');
	
}));

router.get('/editform', wrap(async (req, res) => {
	let thisFuncName = 'orgconfig.editform(root): ';

	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;

	let form_type = req.query.form_type;

	let org_key = req._user.org_key;
	
	let yearStr = req.query.year || req.event.key;
	let year: number;
	if (typeof yearStr === 'string') year = parseInt(yearStr);
	else throw new e.UserError('Either "year" or "key" must be set.');
	
	// load form definition data from the database
	let layoutarray: Layout[] = await utilities.find('layout', {org_key: org_key, year: year, form_type: form_type}, {sort: {'order': 1}});
	// strip out _id, form_type, org_key, year
	let updatedarray: LayoutEdit[] = [];
	layoutarray.forEach( (element) => {
		let newelement: LayoutEdit = element;
		delete newelement['_id'];
		delete newelement['form_type'];
		delete newelement['org_key'];
		delete newelement['year'];
		updatedarray.push(newelement);
	});
	// create a string representation
	let layout = JSON.stringify(updatedarray, null, 2);
	logger.debug(thisFuncName + 'layout=\n' + layout);

	let title = 'Pit Scouting Layout';
	if (form_type == 'matchscouting')
		title = 'Match Scouting Layout';

	res.render('./manage/config/editform', {
		title: title,
		layout: layout,
		form_type: form_type,
		org_key: org_key,
		year: year
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
	formdata.forEach( (element) => {
		// just in case the submission has '_id' attributes, remove them
		delete element['_id'];
		// write (or override existing) attributes
		element.form_type = form_type;
		element.org_key = org_key;
		element.year = year;
	});
	let updatedString = JSON.stringify(formdata);
	logger.debug('updatedString=' + updatedString);

	// 1. delete existing data {if any} matching form_type, org_key, year
	let removeResult: DeleteResult = await utilities.remove('layout', {org_key: org_key, year: year, form_type: form_type});
	logger.info(`Removed ${removeResult.deletedCount} prior form records`);

	// 2. write in new/updated data
	let writeResult: InsertManyResult<Document> | undefined = await utilities.insert('layout', formdata);
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