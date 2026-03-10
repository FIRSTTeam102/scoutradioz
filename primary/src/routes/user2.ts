import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import utilities from 'scoutradioz-utilities';
import wrap, {wrapAPI} from '../helpers/express-async-handler';
// import utilities from '../../../scoutradioz-utilities/src/utilities';
import { matchData as matchDataHelper } from 'scoutradioz-helpers';
import e, { assert } from 'scoutradioz-http-errors';
import type { Org, Role, User, HeatMapColors } from 'scoutradioz-types';
import Permissions from '../helpers/permissions';

const router = express.Router();
const logger = getLogger('user');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

//Redirect to index
router.get('/', wrap(async (req, res) => {
	res.redirect(301, '/home');
}));

router.get('/login', wrap(async (req, res) => {
	logger.addContext('funcName', 'login[get]');
	
	logger.debug('ENTER');
	
	//If there is no user logged in, send them to select-org page
	if( !req.user ){
		return res.redirect('/home?alert=' + req.msgUrl('user.selectorg'));
	}
	//If the user logged in is NOT default_user, then send them to index.
	else if( req.user.name != 'default_user' ){
		return res.redirect('/home?alert=' + req.msgUrl('user.logoutbeforelogin'));
	}
	//Otherwise, proceed.
	
	logger.info(req.getRedirectURL(), typeof req.getRedirectURL());
	res.render('svelte', {
		page: 'user/login',
		title: req.msg('user.loginOrg', {org: req._user.org.nickname}),
		data: {
			org_key: req._user.org.org_key,
			redirectURL: req.getRedirectURL()
		}
	});
}));

router.post('/api/getusers', wrapAPI(async (req, res) => {
	logger.addContext('funcName', 'api/getusers[post]');
	logger.debug('ENTER');
	
	assert(req.user, new e.UnauthorizedError('Not logged in'));

	const org_key = req._user.org_key;
	const org_password = req.body.org_password as string;
	const selectedOrg = req._user.org;

	const passwordHash = selectedOrg.default_password;
	const comparison = await bcrypt.compare( org_password, passwordHash );
	assert(comparison === true, new e.UnauthorizedError('Incorrect org password'));
	//If comparison succeeded, then proceed
	let users: User[] = await utilities.find('users', 
		{
			org_key,
			visible: true,
			role_key: {$ne: 'viewer'} // PJL: do we ever need a non-scouter to sign in?
		}, 
		{sort: {name: 1},
			projection: {
				name: 1,
			}},
		{allowCache: true},
	);
	res.send(users);
}));

router.post('/api/pickuser', wrapAPI(async (req, res) => {
	logger.addContext('funcName', 'api/pickuser[post]');
	logger.debug('ENTER');
	
	assert(req.user, new e.UnauthorizedError('Not logged in'));

	const org_key = req._user.org_key;
	const org_password = req.body.org_password as string;
	const user_id = req.body.user_id as string;
	const selectedOrg = req._user.org;

	let user = await utilities.findOne<any>('users', {
		_id: user_id,
		org_key,
		visible: true,
	});
	assert(user, new e.NotFoundError(`User not found with id: '${user_id}'`));
	
	// Check if password is needed before logging in
	if (user.password !== 'default') {
		logger.debug('Password is needed');
		return res.send({
			password_needed: true
		});
	}
	
	// Check if user needs to create a password if they have special access but don't have a pass yet
	const userRole = await utilities.findOne('roles',
		{role_key: user.role_key}, {},
		{allowCache: true}
	);
	assert(userRole, new e.InternalDatabaseError(`No role exists in DB with key ${user.role_key}`));
	if (userRole.access_level > Permissions.ACCESS_SCOUTER && user.password === 'default') {
		logger.debug('Password creation is needed');
		return res.send({
			create_password: true
		});
	}
	
	// if user password is default and they're just a scouter, then double check org password before logging in
	const passwordHash = selectedOrg.default_password;
	const comparison = await bcrypt.compare( org_password, passwordHash );
	assert(comparison === true, new e.UnauthorizedError('Incorrect org password'));
	
	req.logIn(user, function(err) {
		if (err) {
			logger.error(err);
			return res.status(500).send({message: String(err)});
		}
		res.clearCookie('picked_org'); // if logging in, then clear the previewing-org cookie
		// if user was logged in successfully, return so the page can redirect as needed
		return res.send({
			success: true,
			redirectURL: '/dashboard'
		});
	});
}));

router.get('/logout', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'logout[get]');
	logger.info('ENTER');
	//Logout works a bit differently now.
	
	if( !req.user ) return res.redirect('/home');
	
	let org_key = req.user.org_key;
	
	//destroy session
	req.logout(async () => {
		// after session is destroyed, set picked_org so they go back to default user
		req.session.destroy(() => {
			res.cookie('picked_org', org_key);
			res.redirect('/home');
		});
	});
}));

export default router;