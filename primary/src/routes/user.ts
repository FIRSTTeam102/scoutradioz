import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../helpers/permissions';
import e from '@firstteam102/http-errors';
import { matchData as matchDataHelper } from '@firstteam102/scoutradioz-helpers';
import type { Role, Org, User, Layout } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('user');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

//Redirect to index
router.get('/', wrap(async (req, res) => {
	res.redirect(301, '/');
}));

//no longer used bb
router.get('/selectorg', wrap(async (req, res) =>  {
	
	res.redirect(301, '/');
}));

router.get('/login', wrap(async (req, res) => {
	logger.addContext('funcName', 'login[get]');
	
	logger.debug('ENTER');
	
	//If there is no user logged in, send them to select-org page
	if( !req.user ){
		return res.redirect('/?alert=' + req.msgUrl('user.selectorg'));
	}
	//If the user logged in is NOT default_user, then send them to index.
	else if( req.user.name != 'default_user' ){
		return res.redirect('/?alert=' + req.msgUrl('user.logoutbeforelogin'));
	}
	//Otherwise, proceed.
	
	//Get organization that user has picked
	let org_key = req.user.org_key;
	logger.debug(`User's organization: ${org_key}`);
	
	//search for organization in database
	let selectedOrg: Org = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.status(500).send('Invalid organization');
	
	res.render('./user/login', {
		title: req.msg('user.loginOrg', {org: selectedOrg.nickname}),
		org: selectedOrg,
		redirectURL: req.getFixedRedirectURL()
	});
}));

router.post('/login', wrap(async (req, res) => {
	
	//Redirect to /user/login/select via POST (will preserve request body)
	res.redirect(307, '/user/login/select');
}));

router.post('/login/select', wrap(async (req, res) => {
	logger.addContext('funcName', 'login/select[post]');
	//This URL can only be accessed via a POST method, because it requires an organization's password.
	
	logger.debug('ENTER');
	
	//this can only be accessed if someone has logged in to default_user'
	if( !await req.authenticate( Permissions.ACCESS_VIEWER ) ) return null;
	
	//get contents of request and selected organization
	let org_key: string = req._user.org_key;
	let org_password: string = req.body.org_password;
	logger.debug(`- ${org_key}`);
	
	
	//Make sure that form is filled
	if(!org_key || !org_password || org_key === '' || org_password === ''){
		return res.redirect('/user/login?alert=' + req.msgUrl('user.orgpasswordrequired') + '&rdr=' + req.getFixedRedirectURL());
	}
	
	//If form is filled, then proceed.
	
	//Get org that matches request
	let selectedOrg: Org = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.redirect(500, '/user/selectorg');
	
	let passwordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	let comparison = await bcrypt.compare( org_password, passwordHash );
	
	//If comparison succeeded, then proceed
	if(comparison === true){
		
		// 2022-04-03 JL: Changing "name: {$ne: 'default_user'}" to "visible: true"
		let users: User[] = await utilities.find('users', 
			{org_key: org_key, visible: true}, 
			{sort: {name: 1}},
			{allowCache: true}
		);
				
		res.render('./user/selectuser', {
			title: req.msg('user.loginOrg', {org: selectedOrg.nickname}),
			org: selectedOrg,
			users: users,
			org_password: org_password, //Must be passed back to user so they can send org's password back with their request (Avoid dealing with tokens & cookies)
			redirectURL: req.body.redirectURL,
		});
	}
	//If failed, then redirect with alert
	else{
		res.redirect(`/user/login?alert=${req.msgUrl('user.orgpasswordincorrect', {org: selectedOrg.nickname})}&rdr=${req.getFixedRedirectURL()}`);
	}
}));

router.post('/login/withoutpassword', wrap(async (req, res) => {
	logger.addContext('funcName', 'login/withoutpassword[post]');
	
	//This is where /user/login/selectuser sends a request first
	let userID = req.body.user;
	let org_key = req.body.org_key;
	let org_password = req.body.org_password;
	
	logger.debug(`userID=${userID}`);
	
	//If we don't have organization info, redirect user to login
	if(!org_key || !org_password){
		return res.send({
			status: 400,
			redirect_url: '/user/login?alert=' + req.msgUrl('user.resubmitlogin')
		});
	}
	
	//If no user is selected, send an alert message
	if(!userID){
		return res.send({
			status: 400,
			alert: req.msg('user.selectuser')
		});
	}
	
	//Get org that matches request
	let selectedOrg: Org = await utilities.findOne('orgs',
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.redirect(500, '/user/login');
	
	let passwordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	let comparison = await bcrypt.compare( org_password, passwordHash );
	
	//If password isn't correct for some reason, then cry
	if(!comparison){
		return res.send({
			status: 400,
			redirect_url: '/user/login?alert=' + req.msgUrl('user.resubmitlogin')
		});
	}
	
	//Find user info that matches selected id
	let user = await utilities.findOne('users', {_id: userID});
	
	//if user doesn't exist in database for some reason, then cry
	if(!user){
		return res.send({
			status: 400,
			alert: req.msg('user.nouserexists')
		});
	}
	
	logger.trace(`user: ${JSON.stringify(user)}`);
	
	//Get role information from database, and compare to access role for a scouter
	let role_key = user.role_key;
	let userRole: Role = await utilities.findOne('roles', 
		{role_key: role_key}, {},
		{allowCache: true}
	);
	
	//If no such role exists, throw an error because there must be one
	if(!userRole) throw new Error(`user.js /login/withoutpassword: No role exists in DB with key ${role_key}`);
	
	// 2022-04-03 JL: Sanity check for scoutradioz_admin user. While the bcrypt comparison should always fail when password === "disabled", I'd rather not run the risk. 
	if (user.password === 'disabled') {
		return res.send({
			status: 400,
			alert: 'You cannot sign in as this user.'
		});
	}
	
	//if user's access level is greater than scouter, then a password is required.
	if(userRole.access_level > Permissions.ACCESS_SCOUTER){
		
		//if user does not have a password but NEEDS a password, then they will need to create one
		if( user.password === 'default' ){
			res.send({
				status: 200,
				create_password: true
			});
		}
		//if user has a non-default password, then they will need to enter it
		else{
			res.send({
				status: 200,
				password_needed: true
			});
		}
	} 
	else if(userRole.access_level === Permissions.ACCESS_SCOUTER){
		
		//First, check if the user has a password that is default
		if( user.password === 'default'){
			
			logger.debug('Logging in scouter');
		
			//If password is default, then we may proceed
			req.logIn(user, function(err){
				
				//If error, then log and return an error
				if(err){ console.error(err); return res.send({status: 500, alert: err}); }
				
				logger.debug('Sending success/password_needed: false');
				logger.info(`${user.name} has logged in`);
				
				let redirectURL;
				//if redirectURL has been passed from another function then send it back
				if (req.body.redirectURL) {
					redirectURL = req.body.redirectURL;
				}
				else {
					redirectURL = '/dashboard';
				}
				
				//now, return succes with redirect to dashboard
				res.send({
					status: 200,
					password_needed: false,
					redirect_url: redirectURL,
				});
			});
		}
		else{
			
			logger.debug('Sending password_needed: true');
			
			//if password is not default, then return with password needed.
			res.send({
				status: 200,
				password_needed: true
			});
		}
	}
	else{
		
		logger.debug('Logging in viewer');
		
		//if access_level < Permissions.ACCESS_SCOUTER, then log in user
		req.logIn(user, function(err){
			
			//If error, then log and return an error
			if(err){ console.error(err); return res.send({status: 500, alert: err}); }
			
			logger.info(`${user.name} has logged in`);
			
			//Now, return with redirect_url: '/'
			res.send({
				status: 200,
				password_needed: false,
				redirect_url: '/'
			});
		});
	}
}));

router.post('/login/withpassword', wrap(async (req, res) => {
	logger.addContext('funcName', 'login/withpassword[post]');
	
	let userID = req.body.user;
	let userPassword = req.body.password;
	let org_key = req.body.org_key;
	let org_password = req.body.org_password;
	
	logger.debug(`userID=${userID}`);
	
	//If we don't have organization info, redirect user to login
	if(!org_key || !org_password){
		return res.send({
			status: 400,
			redirect_url: '/user/login?alert=' + req.msgUrl('user.resubmitlogin')
		});
	}
	
	//If no user is selected, send an alert message
	if(!userID){
		return res.send({
			status: 400,
			alert: req.msg('user.selectuser')
		});
	}
	
	//Get org that matches request
	let selectedOrg: Org = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	if(!selectedOrg) return res.redirect(500, '/user/login');
	
	let orgPasswordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	let orgComparison = await bcrypt.compare( org_password, orgPasswordHash );
	
	//If password isn't correct for some reason, then cry
	if(!orgComparison){
		return res.send({
			status: 400,
			redirect_url: '/user/login?alert=' + req.msgUrl('user.resubmitlogin')
		});
	}
	
	//Find user info that matches selected id
	// 2022-05-17 JL: Allowing this variable to be "any" because scoutradioz-types.User is not assignable to express.User (in req.logIn)
	let user = await utilities.findOne('users', {_id: userID});
	
	//if user doesn't exist in database for some reason, then cry
	if(!user || !user.password){
		return res.send({
			status: 400,
			alert: req.msg('user.nouserexists')
		});
	}
	
	//Compare passwords
	let userComparison = await bcrypt.compare( userPassword, user.password );
	
	logger.trace(`password comparison:${userComparison}`);
	
	if(userComparison){
		
		logger.debug('Logging in');
		
		//If comparison succeeded, then log in user
		req.logIn(user, async function(err){
			
			//If error, then log and return an error
			if(err){ logger.error(err); return res.send({status: 500, alert: err}); }
			
			let userRole: Role = await utilities.findOne('roles', 
				{role_key: user.role_key},
				{},
				{allowCache: true}
			);
			
			let redirectURL;
			
			//Set redirect url depending on user's access level
			if (req.body.redirectURL) redirectURL = req.body.redirectURL;
			else if (userRole.access_level === Permissions.ACCESS_GLOBAL_ADMIN) redirectURL = '/admin';
			else if (userRole.access_level === Permissions.ACCESS_TEAM_ADMIN) redirectURL = '/manage';
			else if (userRole.access_level === Permissions.ACCESS_SCOUTER) redirectURL = '/dashboard';
			else redirectURL = '/home';
			
			logger.info(`${user.name} has logged in with role ${userRole.label} (${userRole.access_level}) and is redirected to ${redirectURL}`);
			
			//send success and redirect
			return res.send({
				status: 200,
				redirect_url: redirectURL
			});
		});
	}
	else{
		
		logger.debug('Login failed');
		
		//If authentication failed, then send alert
		return res.send({
			status: 400,
			alert: req.msg('user.incorrectpassword')
		});
	}
}));

router.post('/login/createpassword', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'login/createpassword[post]');
	
	let userID = req.body.user;
	let org_key = req.body.org_key;
	let org_password = req.body.org_password;
	let p1 = req.body.newPassword1;
	let p2 = req.body.newPassword2;
	
	logger.info(`Request to create password: ${JSON.stringify(req.body)}`);
	
	//If we don't have organization info, redirect user to login
	if(!org_key || !org_password){
		return res.send({
			status: 400,
			redirect_url: '/user/login?alert=' + req.msgUrl('user.resubmitlogin')
		});
	}
	
	//If no user is selected, send an alert message
	if(!userID){
		return res.send({
			status: 400,
			alert: req.msg('user.selectuser')
		});
	}
	
	//Get org that matches request
	let selectedOrg: Org = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	if(!selectedOrg) return res.redirect(500, '/user/login');
	
	let orgPasswordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	let orgComparison = await bcrypt.compare( org_password, orgPasswordHash );
	
	//If password isn't correct for some reason, then cry
	if(!orgComparison){
		return res.send({
			status: 400,
			redirect_url: '/user/login?alert=' + req.msgUrl('user.resubmitlogin')
		});
	}
	
	//Find user info that matches selected id
	let user = await utilities.findOne('users', {_id: userID});
	
	//if user doesn't exist in database for some reason, then cry
	if(!user){
		return res.send({
			status: 500,
			alert: req.msg('user.nouserexists')
		});
	}
	
	if(user.password != 'default'){
		return res.send({
			password_needed: true,
			alert: req.msg('user.passwordalreadyexists')
		});
	}
	
	//make sure forms are filled
	if( !p1 || !p2 ){
		return res.send({
			alert: req.msg('user.newpasswordboth')
		});
	}
	if( p1 != p2 ){
		return res.send({
			alert: req.msg('user.newpasswordmismatch')
		});
	}
	
	//Hash new password
	const saltRounds = 10;
	
	let hash = await bcrypt.hash( p1, saltRounds );
	
	let writeResult = await utilities.update('users', {_id: userID}, {$set: {password: hash}});
	
	// logger.debug(`${p1} -> ${hash}`);
	logger.debug('createpassword: ' + JSON.stringify(writeResult, null, 2));
	
	req.logIn(user, function(err){
		
		if(err) logger.error(err);
		
		res.send({
			redirect_url: '/?alert=' + req.msgUrl('user.newpasswordsuccess')
		});
	});
}));

/**
 * User page to change your own password.
 * @url /login/changepassword
 * @view /login/changepassword
 *
 */
router.get('/changepassword', wrap(async (req, res) => {
	logger.addContext('funcName', 'changepassword[get]');
	if( !await req.authenticate( Permissions.ACCESS_SCOUTER ) ) return;
	
	res.render('./user/changepassword', {
		title: req.msg('user.changepassword')
	});
}));

//Page to change your own password.
router.post('/changepassword', wrap(async (req, res) => {
	logger.addContext('funcName', 'changepassword[post]');
	if( !await req.authenticate( Permissions.ACCESS_SCOUTER ) ) return;
	
	let currentPassword = req.body.currentPassword;
	let p1 = req.body.newPassword1;
	let p2 = req.body.newPassword2;
	
	//make sure forms are filled
	if( !p1 || !p2 ){
		return res.redirect('/user/changepassword?alert=' + req.msgUrl('user.createnew') + '&type=error');
	}
	if( p1 != p2 ){
		return res.redirect('/user/changepassword?alert=' + req.msgUrl('user.newpasswordmismatch') + '&type=error');
	}
	
	let passComparison;
	
	//if user's password is set to default, then allow them to change their password
	if( req._user.password === 'default'){
		passComparison = true;
	}
	else{
		passComparison = await bcrypt.compare(currentPassword, req._user.password);
	}
	
	if( !passComparison ){
		return res.redirect('/user/changepassword?alert=' + req.msgUrl('user.incorrectpasswordcurrent') + '&type=error');
	}
	
	//Hash new password
	const saltRounds = 10;
	
	let hash = await bcrypt.hash( p1, saltRounds );
	
	let writeResult = await utilities.update('users', {_id: req._user._id}, {$set: {password: hash}});
	
	logger.debug('changepassword: ' + JSON.stringify(writeResult), true);
	
	res.redirect('/?alert=' + req.msgUrl('user.newpasswordsuccess'));
}));

//Log out
router.get('/logout', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'logout[get]');
	logger.info('ENTER');
	//Logout works a bit differently now.
	//First destroy session, THEN "log in" to default_user of organization.
	
	if( !req.user ) return res.redirect('/');
	
	let org_key = req.user.org_key;
	
	//destroy session
	req.logout();
		
	//after current session is destroyed, now re log in to org
	let selectedOrg: Org = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	if(!selectedOrg) return res.redirect(500, '/');
	
	let defaultUser = await utilities.findOne('users', 
		{'org_key': org_key, name: 'default_user'}, {},
		{allowCache: true}
	);
	if(!defaultUser) return res.redirect(500, '/');
	
	
	//Now, log in to defaultUser
	req.logIn(defaultUser, async function(err){
			
		//If error, then log and return an error
		if(err){ console.error(err); return res.send({status: 500, alert: err}); }
		
		//now, once default user is logged in, redirect to index
		res.redirect('/');
	});
}));

//Switch a user's organization
router.get('/switchorg', wrap(async (req, res) => {
	logger.addContext('funcName', 'switchorg[get]');
	
	//This will log the user out of their organization.
	
	//destroy session
	req.logout();
	
	req.session.destroy(async function (err) {
		if (err) return console.log(err);
		
		//clear org_key cookie
		logger.debug('Clearing org_key cookie');
		res.clearCookie('org_key');
		
		//now, redirect to index
		res.redirect('/');
	});
}));

//user preferences
router.get('/preferences', wrap(async (req, res) => {
	logger.addContext('funcName', 'preferences[get]');
	
	//Currently the only user preferneces page we have
	res.redirect('/user/preferences/reportcolumns');
}));

router.get('/preferences/reportcolumns', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'preferences/reportcolumns[get]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	let thisOrg = req._user.org;
	let thisOrgConfig = thisOrg.config;
	let redirectURL = req.getFixedRedirectURL(); //////////////////////////////
	
	// read in the list of form options
	let matchlayout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	//logger.debug("matchlayout=" + JSON.stringify(matchlayout))
	
	let orgColumnDefaults;
	let orgCols: StringDict = {};
	//Boolean for the view
	let doesOrgHaveNoDefaults = true;
	
	if (thisOrgConfig.columnDefaults && thisOrgConfig.columnDefaults[''+eventYear]) {
		orgColumnDefaults = thisOrgConfig.columnDefaults[''+eventYear];
		doesOrgHaveNoDefaults = false;
	}
	logger.debug(`orgColumnDefaults=${orgColumnDefaults}`);
	
	if (orgColumnDefaults) {
		let orgColArray = orgColumnDefaults.split(',');
		for (let orgCol of orgColArray) {
			orgCols[orgCol] = orgCol;
		}
	}

	let cookieKey = orgKey + '_' + eventYear + '_cols';
	let savedCols: StringDict = {};
	let colCookie = req.cookies[cookieKey];

	if (req.cookies[cookieKey]) {
		logger.trace('req.cookies[cookie_key]=' + JSON.stringify(req.cookies[cookieKey]));
	}

	//colCookie = "a,b,ccc,d";
	if (colCookie) {
		let savedColArray = colCookie.split(',');
		for (let savedCol of savedColArray)
			savedCols[savedCol] = savedCol;
	}
	logger.debug('savedCols=' + JSON.stringify(savedCols));

	res.render('./user/preferences/reportcolumns', {
		title: req.msg('user.reportcolumns.title'),
		layout: matchlayout,
		savedCols: savedCols,
		orgCols: orgCols,
		doesOrgHaveNoDefaults: doesOrgHaveNoDefaults,
		matchDataHelper: matchDataHelper,
		redirectURL: redirectURL,
	});
}));

router.post('/preferences/reportcolumns', wrap(async (req, res) => {
	logger.addContext('funcName', 'preferences/reportcolumns[post]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	let cookieKey = orgKey + '_' + eventYear + '_cols';
	
	//2020-04-04 JL: Added redirectURL to take user back to previous page
	let setOrgDefault = false;
	
	logger.trace('req.body=' + JSON.stringify(req.body));
	
	let columnArray = [];
	for (let key in req.body) {
		if (key === 'setOrgDefault') {
			setOrgDefault = true;
		}
		else if (key === 'redirectURL') {
			// 2020-04-04 JL: Added exceptions to redirectURL 
			// 2022-03-09 JL: Removed exceptions to redirectURL to make the behavior more consistent
			//	(currently only home, but made it a regex to make it easier to add more in the future)
			//	/\b(?:home|foo|bar)/;
			// var redirectExceptions = /\b(?:home)/;
			// if (!redirectExceptions.test(req.body.redirectURL)) {
			// 	redirectURL = req.body.redirectURL;
			// }
		}
		else {
			columnArray.push(key);
		}
	}
	
	let columnCookie = columnArray.join(',');
	
	logger.debug('columnCookie=' + columnCookie);
	
	/*
	var first = true;
	var columnCookie = '';
	for (var i in req.body) {
		if (i === 'setOrgDefault')    // see choosecolumns.pug
			setOrgDefault = true;
		else {
			if (first)
				first = false;
			else
				columnCookie += ','; 
			columnCookie += i;
		}
	}
	*/
	

	res.cookie(cookieKey, columnCookie, {maxAge: 30E9});
	
	// setting org defaults? NOTE only for Team Admins and above
	if (setOrgDefault && req._user.role.access_level >= Permissions.ACCESS_TEAM_ADMIN) {
		logger.debug('Setting org defaults');
		let thisOrg: Org = await utilities.findOne('orgs', 
			{org_key: orgKey}, {},
			{allowCache: true}
		);
		// 2022-05-17 JL: thisOrg.config should never be undefined
		let thisConfig = thisOrg.config;
		if (!thisConfig) throw new e.InternalDatabaseError('Org configuration is missing! - ' + thisOrg.org_key);
		// if (!thisConfig) {
		// 	thisConfig = {};
		// 	thisOrg['config'] = thisConfig;
		// }
		let theseColDefaults = thisOrg.config.columnDefaults;
		if (!theseColDefaults) {
			theseColDefaults = {};
			thisOrg.config['columnDefaults'] = theseColDefaults;
		}

		// set the defaults for this year
		theseColDefaults[eventYear] = columnCookie;
		
		// update DB
		await utilities.update('orgs', {org_key: orgKey}, {$set: {'config.columnDefaults': theseColDefaults}});
		
	}
	
	let redirectURL = req.getFixedRedirectURL() || '/home';
	logger.debug(`Redirect: ${redirectURL}`);

	res.redirect(redirectURL + '?alert=' + req.msgUrl('user.reportcolumns.saved') + '&type=success&autofade=true');
}));

router.post('/preferences/reportcolumns/clearorgdefaultcols', wrap(async (req, res) => {
	logger.addContext('funcName', 'preferences/reportcolumns/clearorgdefaultcols[post]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;

	if (req._user.role.access_level >= Permissions.ACCESS_TEAM_ADMIN) {
		let thisOrg = await utilities.findOne('orgs', 
			{org_key: orgKey}, {},
			{allowCache: true}
		);
		let thisConfig = thisOrg.config;
		//logger.debug("thisConfig=" + JSON.stringify(thisConfig));
		if (!thisConfig) {
			thisConfig = {};
			thisOrg['config'] = thisConfig;
		}
		let theseColDefaults = thisOrg.config.columnDefaults;
		if (!theseColDefaults) {
			theseColDefaults = {};
			thisOrg.config['columnDefaults'] = theseColDefaults;
		}

		// remove values (if they exist) for the event year
		delete theseColDefaults[eventYear];

		// update DB
		await utilities.update('orgs', {org_key: orgKey}, {$set: {'config.columnDefaults': theseColDefaults}});
	}

	res.redirect('/user/preferences/reportcolumns?alert=' + req.msgUrl('user.reportcolumns.clearedorgdefaults') + '&type=success&autofade=true');
}));

module.exports = router;
