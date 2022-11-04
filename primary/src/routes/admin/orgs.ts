import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { MongoDocument } from '@firstteam102/scoutradioz-utilities';
import type { AnyDict, Org, User, Role } from '@firstteam102/scoutradioz-types';
import e from '@firstteam102/http-errors';

const router = express.Router();
const logger = getLogger('orgs');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require global-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'orgs[get]');
	logger.info('ENTER');
	
	const orgs = await utilities.find('orgs', {});
	
	res.render('./admin/orgs', {
		title: 'Manage organizations',
		orgs: orgs
	});
	
}));

router.post('/', wrap(async (req, res) => {
	const thisFuncName = 'orgs[post]: ';
	logger.info('ENTER');
	
	const orgKey = req.body.org_key;
	const nickname = req.body.nickname;
	const teamKey = req.body.team_key;
	const defaultPassword = req.body.default_password;
	
	let org = await utilities.findOne('orgs', {org_key: orgKey});
	
	logger.debug(`${thisFuncName} org=${JSON.stringify(org)}`);
	if (!org) throw new e.UserError('Org could not be found');
	
	logger.info(`${thisFuncName} Updating org ${orgKey}, nickname=${nickname}`);
	
	//Aggregate config.members.subteams and config.members.classes
	// 	note: there is no data structure validation in this code, so when we create an org config
	// 	page, we can't take this code verbatim
	let subteams: AnyDict[] = [];
	let classes: AnyDict[] = [];
	for (let elem in req.body) {
		let split = elem.split('_');
		let elemIdx = parseInt(split[1]);
		let elemType = split[2];
		let elemKey, elemValue;
		let origValue = req.body[elem];
		
		switch (elemType) {
			case 'pitscout':
				elemKey = 'pit_scout';
				console.log(origValue);
				elemValue = (origValue == true);
				break;
			case 'youth':
				elemKey = 'youth';
				elemValue = (origValue == true);
				break;
			case 'subteamkey':
				elemKey = 'subteam_key';
				elemValue = origValue;
				break;
			case 'classkey':
				elemKey = 'class_key';
				elemValue = origValue;
				break;
			case 'seniority':
				elemKey = 'seniority';
				elemValue = parseInt(origValue);
				if (isNaN(elemValue)) {
					logger.error(`${elem} -> ${origValue} is NaN!!`);
					return res.redirect(`/admin/orgs?alert=${elem} -> ${origValue} is NaN!!&type=error`);
				}
				break;
			default:
				elemKey = elemType;
				elemValue = origValue;
		}
		
		//Go through subteams
		if (elem.includes('subteams')) {
			//if there is no subteam at this idx, create it
			if (!subteams[elemIdx]) {
				subteams[elemIdx] = {};
			}
			//pop in this element into the corresponding part of subteams
			subteams[elemIdx][elemKey] = elemValue;
		}
		//Go through classes
		else if (elem.includes('classes')) {
			//if there is no subteam at this idx, create it
			if (!classes[elemIdx]) {
				classes[elemIdx] = {};
			}
			//pop in this element into the corresponding part of classes
			classes[elemIdx][elemKey] = elemValue;
		}
	}
	logger.debug(`${thisFuncName} subteams=${JSON.stringify(subteams)} classes=${JSON.stringify(classes)}`);
	
	//Create update query
	let updateQuery: MongoDocument = {
		$set: {
			nickname: nickname,
			'config.members.subteams': subteams,
			'config.members.classes': classes,
		},
		$unset: {},
	};
	
	//If new default password is set
	if (defaultPassword) {
		//Hash new password
		let hash = await bcrypt.hash(defaultPassword, 10);
		
		logger.info(`${thisFuncName} Setting ${orgKey}'s default password to: ${defaultPassword}`);
		logger.info(`${thisFuncName} Old hash: ${org.default_password} New hash: ${hash}`);
		//Add to updateQuery
		updateQuery['$set'].default_password = hash;
	}
	
	//If a team key is specified
	if (teamKey) {
		// If it's a comma separated list, then set team_keys instead of team_key
		if (teamKey.includes(',')) {
			let teamKeys = teamKey.split(',');
			let fixedTeamKeys = [];
			let teamNumbers = [];
			for (let key of teamKeys) {
				key = key.trim();
				if (!key.startsWith('frc')) throw new e.UserError('Team key is invalid.');
				
				let team = await utilities.findOne('teams', {key: key});
				if (!team) throw new e.UserError(`Team ${key} could not be found`);
				
				teamNumbers.push(team.team_number);
				fixedTeamKeys.push(key);
			}
			updateQuery['$unset'].team_key = '';
			updateQuery['$unset'].team_number = '';
			updateQuery['$set'].team_keys = fixedTeamKeys;
			updateQuery['$set'].team_numbers = teamNumbers;
		}
		else {
			if (!teamKey.startsWith('frc')) throw new e.UserError('Team key is invalid.');
			
			let team = await utilities.findOne('teams', {key: teamKey});
			if (!team) throw new e.UserError(`Team ${teamKey} could not be found`);
			
			updateQuery['$set'].team_key = teamKey;
			updateQuery['$set'].team_number = team.team_number;
			updateQuery['$unset'].team_keys = '';
			updateQuery['$unset'].team_numbers = '';
		}
	}
	
	logger.debug(`${thisFuncName} updateQuery=${JSON.stringify(updateQuery)}`);
	
	const writeResult = await utilities.update('orgs', 
		{org_key: orgKey}, updateQuery
	);
	
	logger.debug(`${thisFuncName} writeResult=${JSON.stringify(writeResult)}`);
	
	res.redirect('/admin/orgs?alert=Updated successfully.&type=good');
}));

// Create a new org, with hardcoded default settings.
router.post('/create', wrap(async (req, res) => {
	logger.addContext('funcName', 'create[post]');
	
	const org_key: string = req.body.org_key;
	const nickname: string = req.body.nickname;
	const teamKeyOrKeys: string = req.body.team_key;
	const default_password: string = req.body.default_password;
	
	if (!org_key) return res.send({status: 400, message: 'No org key specified.'});
	if (!nickname) return res.send({status: 400, message: 'No nickname specified.'});
	if (!default_password) return res.send({status: 400, message: 'No password specified.'});
	
	let existingOrg = await utilities.findOne('orgs', {org_key: org_key});
	if (existingOrg) return res.send({status: 400, message: `An org already exists with key ${org_key}!`});
	
	// Create the org with the default subteams.
	const defaultSubteams = [
		{
			label: 'Mechanical',
			subteam_key: 'mech',
			pit_scout: true,
		},
		{
			label: 'Electrical',
			subteam_key: 'elec',
			pit_scout: true,
		},
		{
			label: 'Programming',
			subteam_key: 'prog',
			pit_scout: true,
		},
		{
			label: 'Drive',
			subteam_key: 'drive',
			pit_scout: false,
		},
		{
			label: 'Lead',
			subteam_key: 'lead',
			pit_scout: false,
		},
		{
			label: 'Non-Student',
			subteam_key: 'nonstudent',
			pit_scout: false,
		},
	];
	const defaultClasses = [
		{
			label: 'Freshman',
			class_key: 'freshman',
			seniority: 1,
			youth: true
		},
		{
			label: 'Sophomore',
			class_key: 'sophomore',
			seniority: 2,
			youth: true
		},
		{
			label: 'Junior',
			class_key: 'junior',
			seniority: 3,
			youth: true
		},
		{
			label: 'Senior',
			class_key: 'senior',
			seniority: 4,
			youth: true
		},
		{
			label: 'Alum',
			class_key: 'alum',
			seniority: 5,
			youth: false
		},
		{
			label: 'Middle School',
			class_key: 'middleschool',
			seniority: 0,
			youth: true
		},
		{
			label: 'Mentor',
			class_key: 'mentor',
			seniority: 7,
			youth: false
		},
		{
			label: 'Parent',
			class_key: 'parent',
			seniority: 6,
			youth: false
		}
	];
	
	// Hash the new default password
	const newPassword = await bcrypt.hash(default_password, 10);
	
	// New object to insert into db.orgs
	const newOrg: Org = {
		org_key: org_key,
		nickname: nickname,
		default_password: newPassword,
		config: {
			members: {
				subteams: defaultSubteams,
				classes: defaultClasses,
			},
			columnDefaults: {}
		}
	};
	
	//If a team key is specified
	if (teamKeyOrKeys) {
		// If it's a comma separated list, then set team_keys instead of team_key
		if (teamKeyOrKeys.includes(',')) {
			let teamKeys = teamKeyOrKeys.split(',');
			let fixedTeamKeys = [];
			let teamNumbers = [];
			for (let key of teamKeys) {
				key = key.trim();
				if (!key.startsWith('frc')) throw new e.UserError('Team key is invalid.');
				
				let team = await utilities.findOne('teams', {key: key});
				if (!team) throw new e.UserError(`Team ${key} could not be found`);
				
				teamNumbers.push(team.team_number);
				fixedTeamKeys.push(key);
			}
			newOrg.team_keys = fixedTeamKeys;
			newOrg.team_numbers = teamNumbers;
		}
		else {
			let teamKey = teamKeyOrKeys.trim();
			if (!teamKey.startsWith('frc')) return res.send({status: 400, message: 'Team key is invalid.'});
			
			let team = await utilities.findOne('teams', {key: teamKey});
			if (!team) return res.send({status: 400, message: `Team ${teamKey} could not be found`});
			
			newOrg.team_key = teamKey;
			newOrg.team_number = team.team_number;
		}
	}
	
	// New default users to create
	// default_user is the one that everyone logs in to when they select an org
	const newDefaultUser = {
		org_key: org_key,
		name: 'default_user',
		role_key: 'viewer',
		password: 'default',
		org_info: {},
		event_info: {},
		visible: false,
	};
	// scoutradioz_admin is used for /login-to-org
	const newScoutradiozAdmin = {
		org_key: org_key,
		name: 'scoutradioz_admin',
		role_key: 'global_admin',
		password: 'disabled',
		org_info: {},
		event_info: {},
		visible: false,
	};
	
	logger.info(`Creating org: key=${org_key} nick=${nickname} defaultPass=${default_password} teamkeyOrKeys=${teamKeyOrKeys}`);
	
	let orgWriteResult = await utilities.insert('orgs', newOrg);
	let userWriteResult = await utilities.insert('users', [newDefaultUser, newScoutradiozAdmin]);
	
	logger.info(`orgWriteResult=${JSON.stringify(orgWriteResult)} userWriteResult=${JSON.stringify(userWriteResult)}`);
	
	res.send({status: 200, message: 'Created org successfully.'});
}));

router.post('/delete', wrap(async (req, res) => {
	logger.addContext('funcName', 'delete[post]');
	
	const org_key = req.body.org_key;
	const password = req.body.password;
	
	if (!org_key || !password) return res.send({status: 400, message: 'Org key and password must be provided.'});
	if (!req.user) return res.send({status: 500});
	
	const user = await utilities.findOne('users', {_id: req.user._id});
	const comparison = await bcrypt.compare(password, user.password);
	
	logger.warn(`User ${user.name} from ${user.org_key} is requesting to delete ${org_key}!!!`);
	
	if (comparison === true && user.password !== 'disabled') {
		logger.info('Password check completed... Going to delete the org!');
		
		const org = await utilities.findOne('orgs', {org_key: org_key});
		if (!org) {
			logger.info('Org does not exist');
			return res.send({status: 400, message: 'Org does not exist'});
		}
		const users = await utilities.find('users', {org_key: org_key});
		
		logger.info(`Org to be deleted: ${JSON.stringify(org)}`);
		logger.info(`Users to be deleted: ${JSON.stringify(users)}`);
		
		let writeResult = await utilities.remove('orgs', {org_key: org_key});
		logger.debug(`Org write result: ${JSON.stringify(writeResult)}`);
		
		writeResult = await utilities.remove('users', {org_key: org_key});
		logger.debug(`Org write result: ${JSON.stringify(writeResult)}`);
		
		res.send({status: 200, message: `Deleted org successfully, as well as ${users.length} users.`});
	}
	else {
		res.send({status: 403, message: 'Incorrect password.'});
	}
}));

router.post('/login-to-org', wrap(async (req, res) => {
	logger.addContext('funcName', 'login-to-org[post]');
	
	const org_key = req.body.org_key;
	const user_org_key = String(req.body.user_org_key);
	const username = String(req.body.username);
	const password = String(req.body.password);
	
	if (!org_key || !password) return res.send({status: 400, message: 'Password must be provided.'});
	if (!req.user) return res.send({status: 500});
	
	let user: User;
	let userRole: Role;
	// If logged in as SR_admin, we need to retrieve their user details
	if (req.user.name === 'scoutradioz_admin') {
		user = await utilities.findOne('users', {org_key: user_org_key, name: username});
		if (!user) return res.send({status: 404, message: `User with name "${username}" and org_key ${user_org_key} not found.`});
		userRole = await utilities.findOne('roles', {role_key: user.role_key});
	}
	// already logged-in normal user
	else {
		// Get a fresh copy of the user from the DB, and their associated role.
		user = await utilities.findOne('users', {_id: req.user._id});
		userRole = await utilities.findOne('roles', {role_key: user.role_key});
	}
	
	// Check their password.
	const comparison = await bcrypt.compare(password, user.password);
	
	logger.warn(`User ${user.name} from ${user.org_key} is requesting to log in to ${org_key} as Scoutradioz Admin`);
	
	// If user.password === "disabled" then that means they're already logged in as a SR admin under a specific org.
	// If their access_level < ACCESS_GLOBAL_ADMIN, then something went wrong with our authentication code.
	if (comparison === true && user.password !== 'disabled' && userRole.access_level >= Permissions.ACCESS_GLOBAL_ADMIN) {
		
		logger.info('Password check completed... Going to log in!');
		
		// Get the SR admin user from the DB from the associated org.
		const SRAdminUser = await utilities.findOne('users', {org_key: org_key, name: 'scoutradioz_admin', role_key: userRole.role_key});
		
		if (!SRAdminUser) {
			return res.send({status: 500, message: 'Could not find SR admin user in the database.'});
		}
		
		// First, log out
		req.logout();
		
		// Next, log in as the new SR admin user
		req.logIn(SRAdminUser, (err) => {
			if (err) {
				logger.error(err);
				req.logout();
				return res.send({status: 500, message: err});
			}
			// After they're logged in, send a success message & they'll be redirected from the client script
			res.send({status: 200});
		});
	}
	else {
		res.send({status: 401, message: 'Incorrect password or unauthorized.'});
	}
	
}));

module.exports = router;