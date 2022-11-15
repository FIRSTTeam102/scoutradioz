import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { User } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('tests');

router.all('/*', wrap(async (req, res, next) => {
	return next(); // remove later maybe
	
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require global-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res, next) => {
	
	res.render('./admin/tests/index', {
		title: 'QUnit Tests',
	});
}));

const TEMP_USER_NAME = '*TEMPORARY TESTING USER*';

router.all('/login-to-org-data', async (req, res, next) => {
	
	const org_key = 'demo';
	const org_passwd = 'demo2022'; // JL note: this isn't much of a secret, and if someone's gone far enough into SR's code to discover hidden passwords, then hello! Wanna join the dev team?
	
	let userWithoutPassword: User = await utilities.findOne('users', 
		{org_key: org_key, password: 'default'}
	);
	let userWithPassword: User = await utilities.findOne('users', 
		{org_key: org_key, password: {$ne: 'default'}}
	);
	
	res.send({
		passwd: org_passwd,
		userWithoutPassword: String(userWithoutPassword._id),
		userWithPassword: String(userWithPassword._id),
	});
});

router.all('/password-creation-data', async (req, res, next) => {
	
	const org_key = 'demo';
	
	let tempUser: User = {
		name: TEMP_USER_NAME,
		org_key: org_key,
		role_key: 'team_admin',
		org_info: {
			subteam_key: '',
			class_key: '',
			years: '',
			seniority: ''
		},
		event_info: {
			present: false,
			assigned: false,
		},
		visible: true,
		password: 'default'
	};
	await utilities.insert('users', tempUser);
	let newUser: User = await utilities.findOne('users', {name: TEMP_USER_NAME});
	
	res.send({
		userForPasswordCreation: String(newUser._id),
	});
});

router.all('/remove-temp-user', async (req, res, next) => {
	
	await utilities.remove('users', {name: TEMP_USER_NAME});
	
	res.send({
		ok: true
	});
});

// Just to verify that the temp user has been successfully removed (sanity check)
router.all('/verify-temp-user-removed', async (req, res, next) => {
	
	const users: User[] = await utilities.find('users', {name: TEMP_USER_NAME});
	
	res.send({
		ok: (users.length === 0)
	});
});

module.exports = router;