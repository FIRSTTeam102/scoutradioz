import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import e, { HttpError, assert } from 'scoutradioz-http-errors';
import { upload as uploadHelper } from 'scoutradioz-helpers';
import type { Layout, MatchFormData, MatchScouting, OrgSchema, SchemaItem, Schema, SprCalculation } from 'scoutradioz-types';
import type { MongoDocument } from 'scoutradioz-utilities';
import utilities from 'scoutradioz-utilities';
import wrap from '../../helpers/express-async-handler';
import { getSubteamsAndClasses } from '../../helpers/orgconfig';
import Permissions from '../../helpers/permissions';
import { validateJSONLayout, validateSprLayout } from 'scoutradioz-helpers';
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
		title: req.msg('manage.config.title', { org: org.nickname }),
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
				let team = await utilities.findOne('teams', { team_number });
				assert(team, new e.UserError(req.msg('manage.config.invalidTeams', { number: team_number })));
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
			updateQuery.$set.team_key = 'frc' + teamNumbers[0];
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
			updateQuery.$set.team_keys = teamNumbers.map(number => 'frc' + number);
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
	logger.addContext('funcName', 'orgconfig.editform[GET]');

	if (!await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) return;

	let form_type = req.query.form_type;

	assert(form_type === 'matchscouting' || form_type === 'pitscouting', new e.UserError('Invalid form type'));

	let org_key = req._user.org_key;

	let year = parseInt(String(req.query.year)) || req.event.year;
	if (!year || isNaN(year)) throw new e.UserError('Either "year" or "key" must be set.');

	if (year === -1) {
		let currentYear = new Date().getFullYear();
		logger.debug(`Year is -1, aka, event not set. Setting year to current year: ${currentYear}`);
		year = currentYear;
	}

	// load form definition data from the database
	let schema: Schema | undefined,
		// default "blank" layout, with sample data
		layout = `[
			{ "type": "header", "label": "Sample" },
			{ "type": "subheader", "label": "Replace this JSON with the code that defines your scouting form" },
			{ "type": "spacer" },
			{ "type": "multiselect", "label": "You can insert form elements of the following type:", "options": [ "header", "subheader", "spacer", "checkbox", "textblock", "counter", "multiselect", "slider", "derived" ], "id": "yourIdsShouldBeCamelCase" }
		]`,
		// 2025-02-01, M.O'C: Adding SPR calculations
		// default "blank" sprLayout, with default data
		sprLayout = `{
			"points_per_robot_metric": "contributedPoints",
			"subtract_points_from_FRC": {
				"foulPoints": 1
			}
		}`;

	const orgschema = await utilities.findOne('orgschemas',
		{ org_key, year, form_type },
	);
	if (orgschema) {
		schema = await utilities.findOne('schemas',
			{ _id: orgschema.schema_id, owners: org_key },
		);
		assert(schema, `For ${org_key} and ${year}, orgschema existed in the database but pointed to nonexistent schema!`);
		// Create string representation of layout
		layout = JSON.stringify(schema.layout).replace(/`/g, '\\`');
		// 2025-02-01, M.O'C: Only do if SPR calculation exists
		if (schema.spr_calculation)
			sprLayout = JSON.stringify(schema.spr_calculation).replace(/`/g, '\\`');
		else
			logger.info(`For ${org_key} and ${year}, orgschema existed in the database but had no SPR calculation - using default`);
	}

	// Get name, description, and whether it's published from the schema (or assign defaults)
	let { name, description, published } = schema || {
		name: `${org_key}'s ${year} ${form_type} Form`,
		description: '',
		published: false
	};
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
		layout,
		sprLayout,
		name,
		description,
		published,
		form_type,
		org_key,
		year,
		previousDataExists,
		previousKeys
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

	const jsonString = req.body.jsonString;
	logger.debug('jsonString=' + jsonString);
	const sprString = req.body.sprString;
	logger.debug('sprString=' + sprString);
	const year = parseInt(req.body.year);
	logger.debug('year=' + year);
	const form_type = req.body.form_type;
	logger.debug('form_type=' + form_type);
	const save = (req.body.save === 'true');

	assert(!isNaN(year), 'invalid year!');
	assert(['matchscouting', 'pitscouting'].includes(form_type), 'invalid form_type!');

	// Validate json layout
	const jsonParsed = JSON.parse(jsonString);
	const { warnings, layout } = validateJSONLayout(jsonParsed);

	// 2025-02-01, M.O'C: Adding in SPR calcs for match scouting
	let sprLayout: SprCalculation | undefined;
	if (form_type === 'matchscouting') {
		const sprParsed = JSON.parse(sprString);
		sprLayout = validateSprLayout(sprParsed, jsonParsed);
	}

	/**
	 * TODO:
	 * 	1. [DONE] Server-side validation of schema being ok
	 * 	2. Take schema ID as user input, rather than just current schema set by org?
	 * 	3. If IDs do not change, then update the existing schema; if IDs do change, create new schema
	 * 	4. Publishing shiz
	 */

	if (save) {
		logger.info('save=true; saving schema that was uploaded');

		// Get existing schema metadata from db
		const orgschema = await utilities.findOne('orgschemas',
			{ org_key, year, form_type },
		);
		// schema did exist in db; update it now
		if (orgschema) {
			const schema = await utilities.findOne('schemas',
				{ _id: orgschema.schema_id, owners: org_key },
			);
			assert(schema, new e.InternalServerError(`For ${org_key} and ${year}, orgschema existed in the database but pointed to nonexistent schema!`));
			// Insert validated & updated layout 
			let writeResult = await utilities.update('schemas',
				{ _id: schema._id, },
				{
					$set: {
						layout,
						spr_calculation: sprLayout,
						last_modified: new Date(),
					}
				}
			);
			logger.info('writeResult=', writeResult);
			if (writeResult.modifiedCount !== 1) {
				throw new e.InternalServerError(`modifiedCount !== 1! ${JSON.stringify(writeResult)}`);
			}
		}
		// schema didn't exist in db; create it now
		else {
			let newSchema: Schema = {
				year,
				last_modified: new Date(),
				created: new Date(),
				form_type,
				layout,
				spr_calculation: sprLayout,
				name: `${org_key}'s ${year} ${form_type} form`,
				description: '',
				published: false,
				owners: [org_key],
			};
			let insertResult = await utilities.insert('schemas', newSchema);

			logger.debug(`insertResult for inserting schema=${JSON.stringify(insertResult)}`);
			assert(insertResult.insertedId, new e.InternalServerError('insertResult did not result in an insertedId!'));

			let newOrgSchema: OrgSchema = {
				org_key,
				year,
				form_type,
				schema_id: insertResult.insertedId,
			};

			insertResult = await utilities.insert('orgschemas', newOrgSchema);
			logger.debug(`insertResult for inserting orgschema=${JSON.stringify(insertResult)}`);
		}
	}

	return res.send({
		warnings,
		layout,
		sprLayout,
		saved: save
	});
}));

// 2025-02-0, M.O'C: Added 'org specific' photo uploads
router.get('/uploads', wrap(async (req, res) => {
	
	const org_key = req._user.org_key;
	
	let uploadURL = process.env.UPLOAD_URL + '/' + process.env.TIER + '/image';

	// Get the year from either the HTTP query or the current event
	let year;
	if (typeof req.query.year === 'string') year = parseInt(req.query.year);
	if (!year || isNaN(year)) year = req.event.year;
	
	let uploads: Upload[] = await utilities.find('uploads', 
		{org_key: org_key, photo_id: { $exists: true }, removed: false, year: year},
		{},
	);
	
	// Years that contain any non-removed uploads
	// Look specifically for records which have 'team_key' (i.e., uploaded during pit scouting)
	let years = await utilities.distinct('uploads', 'year', {org_key: org_key, photo_id: { $exists: true }, removed: false});
	
	uploads.sort((a, b) => {
		if ( a.photo_id < b.photo_id ){
			return -1;
		}
		if ( a.photo_id > b.photo_id ){
			return 1;
		}
		return 0;
	});
	//logger.debug(`uploads=${JSON.stringify(uploads)}`);
	
	// 2022-03-08 JL: Previous logic didn't work, it always left out at least one document
	let uploadsByPhotoId: Dict<(Upload & {links: ImageLinks})[]> = {};
	for (let upload of uploads) {
		//logger.debug(`upload=${JSON.stringify(upload)}`);
		if (upload.hasOwnProperty('photo_id')) {
			let key = upload.photo_id;
			if (!uploadsByPhotoId[key]) uploadsByPhotoId[key] = [];
			// Clone of the upload but with links added
			let uploadWithLinks = {
				...upload,
				links: uploadHelper.getLinks(upload)
			};
			//logger.debug(`uploadWithLinks=${JSON.stringify(uploadWithLinks)}`);
			uploadsByPhotoId[key].push(uploadWithLinks);
		}
	}
	//logger.debug(`uploadsByPhotoId=${JSON.stringify(uploadsByPhotoId)}`);
	
	res.render('./manage/config/uploads', {
		title: 'Organization Uploads',
		uploadsByPhotoId: uploadsByPhotoId,
		years: years,
		thisYear: year,
		uploadURL: uploadURL,
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
