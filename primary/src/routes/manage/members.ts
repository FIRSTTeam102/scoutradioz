import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { Org, Role, User } from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('members');

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'index[get]');
	logger.info('ENTER');
	
	let thisUser = req._user;
	let org_key = thisUser.org_key;
	
	let orgMembers: User[] = await utilities.find('users', {org_key: org_key, visible: true}, {sort: {'name': 1}});
	let org: Org = await utilities.findOne('orgs', {org_key: org_key});
	
	let roles: Role[] = await utilities.find('roles', { access_level: { $lte: thisUser.role.access_level }});
	
	let config = org.config.members;
	
	
	let membersByRole: Dict<User[]> = {};
	
	for( let thisRole of roles ){
		
		membersByRole[ thisRole.label ] = [];
		
		for( let thisMember of orgMembers ){
			
			if( thisMember.role_key == thisRole.role_key ){
				
				membersByRole[ thisRole.label ].push( thisMember );
			}
		}
	}
	
	res.render('./manage/members/index', { 
		title: req.msg('manage.members.main'),
		membersByRole: membersByRole,
		config: config,
		roles: roles
	});
}));

router.post('/addmember', wrap(async (req, res) => {
	logger.addContext('funcName', 'addmember[post]');
	logger.info('ENTER');
	
	let thisUser = req._user;
	let name = req.body.name;
	let subteam_key = req.body.subteam_key;
	let class_key = req.body.class_key;
	let years = req.body.years;
	let role_key = req.body.role_key;
	
	let org_key = thisUser.org_key;
	
	if(!name || name == ''){
		return res.redirect('/manage/members?alert=User must have a name.&type=error');
	}
	if (name.toLowerCase() === 'default_user') {
		return res.redirect('/manage/members?alert=You cannot create a user with that name.&type=error');
	}
	
	let requestedRole: Role = await utilities.findOne('roles', {role_key: role_key});
	
	if( !requestedRole ){
		return res.redirect('/manage/members?alert=Invalid role requested.');
	}
	if( requestedRole.access_level > thisUser.role.access_level ){
		return res.redirect('/manage/members?alert=You do not have permission to create a user with that role.');
	}
	
	let memberJson = JSON.stringify(req.body);
	logger.debug(`Request to add member ${memberJson}`, true);

	// calculate seniority
	let seniority = years;
	// sanity-check! use '0' if it's not already a parseable int
	if (isNaN(parseInt(seniority))) seniority = '0';
	
	// Get the first 3 characters, all lower case
	let classPre = class_key.toLowerCase().substring(0, 3);
	switch(classPre) {
		case 'fre':
			seniority += '.1';
			break;
		case 'sop':
			seniority += '.2';
			break;
		case 'jun':
			seniority += '.3';
			break;
		case 'sen':
			seniority += '.4';
			break;
		default:
			seniority += '.0';
	}
	logger.debug('seniority=' + seniority);
	
	let insertQuery: User = {
		org_key: org_key,
		name: name,
		role_key: role_key,
		password: 'default',
		org_info: {
			subteam_key: subteam_key,
			class_key: class_key,
			years: years,
			seniority: seniority
		},
		event_info:{
			present: false,
			assigned: false
		},
		oauth: {},
		visible: true,
		removed: false,
	};
	
	let writeResult = await utilities.insert('users', insertQuery);
	
	res.redirect('/manage/members#addMember');
}));

router.post('/updatemember', wrap(async (req, res) => {
	logger.addContext('funcName', 'updatemember[post]');
	logger.info('ENTER');
	
	const thisUser = req._user;
	const org_key = thisUser.org_key;
	const memberId = req.body.memberId;
	const name = req.body.name;
	const subteam_key = req.body.subteam_key;
	const class_key = req.body.class_key;
	const years = req.body.years;
	const role_key = req.body.role_key;
	
	
	if(!name || name == ''){
		return res.send({
			status: 400, message: 'User must have a name.'
		});
	}
	if (name.toLowerCase() === 'default_user' || name.toLowerCase() === 'scoutradioz_admin') {
		return res.send({
			status: 400, message: 'You cannot give a user that name.'
		});
	}
	
	const thisOrg = thisUser.org;
	
	if (!class_key || !subteam_key) {
		return res.send({
			status: 400,
			message: 'Please provide a subteam and a class.'
		});
	}
	
	// Check whether the specified class key exists in the org config
	if (!thisOrg.config.members.classes.some((thisClass) => thisClass.class_key === class_key)) {
		return res.send({
			status: 500,
			message: 'The provided class could not be found in your organization\'s configuration.'
		});
	}
	
	if (!thisOrg.config.members.subteams.some((thisSubteam) => thisSubteam.subteam_key === subteam_key)) {
		return res.send({
			status: 500,
			message: 'The provided subteam could not be found in your organization\'s configuration.'
		});
	}
	
	// recalculate seniority
	let seniority = years;
	// sanity-check! use '0' if it's not already a parseable int
	if (isNaN(parseInt(seniority))) seniority = '0';
	
	// Get the first 3 characters, all lower case
	let classPre = class_key.toLowerCase().substring(0, 3);
	switch(classPre) {
		case 'fre':
			seniority += '.1';
			break;
		case 'sop':
			seniority += '.2';
			break;
		case 'jun':
			seniority += '.3';
			break;
		case 'sen':
			seniority += '.4';
			break;
		default:
			seniority += '.0';
	}
	
	// 2022-03-02 JL: Needed to shuffle the logic a bit so that the final update query only uses _id (not org_key) so that utilities cache is cleared for that query
	let existingUserPreEdit: User = await utilities.findOne('users', {org_key: org_key, _id: memberId});
	if (!existingUserPreEdit) return res.send({
		status: 400,
		message: 'The requested user does not exist inside your organization.'
	});
	let existingUserRole: Role = await utilities.findOne('roles', {role_key: existingUserPreEdit.role_key});
	
	//Check the role of the user they're trying to edit, and see if they are authorized to edit that user
	if( existingUserRole.access_level > thisUser.role.access_level ){
		
		res.send({
			status: 401,
			message: 'You do not have permission to edit that user.'
		});
	}
	else{
		
		let requestedRole: Role = await utilities.findOne('roles', {role_key: role_key});
		
		//Check the role they're trying to give the user, and see if they are authorized to give that role
		if( !requestedRole || requestedRole.access_level > thisUser.role.access_level ){
			res.send({
				status: 401,
				message: 'You do not have permission to set a role of this level.'
			});
		}
		else{
			//Query to update user in db
			let updateQuery = {
				$set: {
					name: name,
					role_key: role_key,
					org_info: {
						subteam_key: subteam_key,
						class_key: class_key,
						years: years,
						seniority: seniority
					}
				}
			};
			
			//log it
			logger.debug(`Request to update member ${memberId} with details ${JSON.stringify(updateQuery)}`, true);
			
			let writeResult = await utilities.update('users', {_id: memberId}, updateQuery);
			
			console.log(writeResult);
			
			res.send({
				status: 200,
				message: `Updated ${name} successfully.`
			});
		}
	}
}));

router.post('/deletemember', wrap(async (req, res) => {
	logger.addContext('funcName', 'deletemember[post]');
	logger.info('ENTER');
	
	let thisUser = req._user;
	
	if(req.body.memberId){
		
		let memberId = req.body.memberId;
		let orgKey = thisUser.org_key;
		
		let member: User = await utilities.findOne('users', {_id: memberId, org_key: orgKey});
		let memberRole: Role = await utilities.findOne('roles', {role_key: member.role_key});
		
		logger.debug(`Request to delete member ${memberId} by user ${JSON.stringify(req.user)}`, true);
		
		//check for authorization
		if( thisUser.role.access_level >= memberRole.access_level ){
			
			//check if someone's trying to delete themselves (Don't do that!)
			if(thisUser._id != memberId){
				
				let writeResult = await utilities.remove('users', {_id: memberId});
				
				res.redirect('/manage/members?alert=Removed user successfully.');
			}
			else{
				res.redirect('/manage/members?alert=Don\'t delete yourself, you silly goose!');
			}
		}
		else{
			
			res.redirect('/manage/members?alert=Unauthorized to delete this user.');
		}
	}
}));

/* TODO JL: Increment/decrement # years on team
router.post('/batch', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[get]');
	logger.debug('ENTER');
	
	var orgKey = req.user.org_key;
	
	// Get a list of all users with access level <= the logged-in user
	var users = await utilities.aggregate('users', [
		{$match: {org_key: orgKey, visible: true}},
		{$lookup: {
			from: 'roles',
			localField: 'role_key',
			foreignField: 'role_key',
			as: 'role'
		}},
		{$match: {
			'role.access_level': {$lte: req.user.role.access_level}
		}},
		{$project: {name: 1}},
	]);
	
	// Get an array of just the IDs
	var userIDs = [];
	for (let user of users) {
		userIDs.push(user._id);
	}
	
	var writeResult;
	
	if (req.query.action === 'incrementYears') {
		logger.info(`Incrementing # years for ${userIDs.length} users`);
		writeResult = await utilities.update('users', {
			org_key: orgKey, 
			visible: true, 
			_id: {$in: userIDs}
		}, {
			$inc: {'org_info.years': 1}
		});
	}
	else if (req.query.action === 'decrementYears') {
		logger.info(`Decrementing # years for ${userIDs.length} users`);
	}
	else {
		logger.debug('Invalid action ' + req.query.action);
		return res.send('Invalid action ' + req.query.action);
	}
	logger.debug('Done, writeResult=' + JSON.stringify(writeResult));
}));
*/

router.get('/passwords', wrap(async (req, res) => {
	logger.addContext('funcName', 'passwords[get]');
	logger.info('ENTER');
	
	const thisUser = req._user;
	let orgKey = thisUser.org_key;
	
	let orgMembers: User[] = await utilities.find('users', {org_key: orgKey, visible: true}, {sort: {'name': 1}});
	
	let roles: Role[] = await utilities.find('roles', { access_level: { $lte: thisUser.role.access_level }});
	
	let membersByRole: Dict<User[]> = {};
	
	for( let thisRole of roles ){
		
		membersByRole[ thisRole.label ] = [];
		
		for( let thisMember of orgMembers ){
			
			if( thisMember.role_key == thisRole.role_key ){
				
				membersByRole[ thisRole.label ].push( thisMember );
			}
		}
	}		
	
	res.render('./manage/members/passwords', { 
		title: 'Manage Member Passwords',
		membersByRole: membersByRole,
		roles: roles
	});
}));

router.post('/resetpassword', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'resetpassword[post]');
	logger.info('ENTER');
	
	const memberId = req.body.memberId;
	const thisUser = req._user;
	
	try {
		//get info on requested member
		const member: User = await utilities.findOne('users', {_id: memberId});
		logger.info(`Request to reset password of ${member.name} by ${thisUser.name}`);
		const memberRole: Role = await utilities.findOne('roles', {role_key: member.role_key});
		
		//check if user is authorized to edit the selected member
		if (memberRole.access_level <= thisUser.role.access_level) {
			
			const writeResult = await utilities.update('users', 
				{_id: memberId}, {$set: {'password': 'default'}});
				
			logger.info(`Reset password of ${member.name} successfully.`);
			res.send({status: 200, message: 'Reset password successfully.'});
		}
		//if unauthorized, return unauthorized message
		else {
			logger.info(`User ${thisUser.name} unauthorized to edit ${member.name}`);
			res.send({status: 401, message: 'Unauthorized to edit this user.'});
		}
	}
	//catch-all for any other errors
	catch (err) {
		logger.error(err);
		res.send({status: 500, message: JSON.stringify(err)});
	}
}));

router.get('/present', wrap(async (req, res) => {
	
	//2019-11-20 JL: updated to only work with members of the right organization.
	const orgKey = req._user.org_key;
	
	let users: User[] = await utilities.find('users', {org_key: orgKey, visible: true}, {sort: {'name': 1}});
	logger.trace('members.present: users=' + JSON.stringify(users));

	res.render('./manage/members/present', {
		title: 'Assign Who Is Present',
		members: users
	});
}));

router.post('/updatepresent', wrap(async (req, res) => {
	logger.addContext('funcName', 'updatepresent[post]');
	logger.info('ENTER');
	
	//2019-11-20 JL: updated to only work with members of the right organization.
	const orgKey = req._user.org_key;
	
	await utilities.update('users', {org_key: orgKey, visible: true}, { $set: { 'event_info.present' : false } }, {});
	
	//Get a list of all present member IDs.
	let allPresentMembers = [];
	//eslint-disable-next-line
	for(var i in req.body) {
		allPresentMembers.push(Number(i));
	}
	
	logger.debug(`updatepresent: allPresentMembers: ${JSON.stringify(allPresentMembers)}`);
	
	let query = {'_id': {$in: allPresentMembers}, org_key: orgKey};
	let update = {$set: {'event_info.present': true}};
	
	await utilities.update('users', query, update, {});
	
	res.redirect('./present');
}));

module.exports = router;
