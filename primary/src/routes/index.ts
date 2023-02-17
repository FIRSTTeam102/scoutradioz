import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import e from 'scoutradioz-http-errors';

const router = express.Router();
const logger = getLogger('index');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

/**
 * The "index" page that loads is now a form to select an organization.
 */
router.get('/', wrap(async (req, res, next) => {
	logger.addContext('funcName', 'root[get]');
	logger.debug('ENTER');
	
	//If there is a logged-in user, that means they HAVE selected an org, and 
	// so then redirect to /home
	//If user has not selected an org (not logged in), send them to pick-org page.
	if( req.user ){
		
		//added originalUrl to make GET queries to persist (for alert)
		res.redirect(307, '/home' + req.originalUrl);
	}
	else if ( req.query.org_key || req.cookies.org_key ){
		//Prioritize QUERY org key over cookies
		//If someone wishes to share a page in the future, the link will include org_key
		let orgKey = req.query.org_key || req.cookies.org_key;
		
		//redirect to selectorg with the selected org_key to sign in to the org user
		res.redirect(307, `/selectorg?org_key=${orgKey}&redirectURL=${req.originalUrl}`);
	}
	else{
		
		// 2022-02-19 JL: Replaced all that timely/expensive eventMap stuff with a single aggregate call
		const aggPipeline = [
			{$sort: {team_number: 1, org_key: 1}},
			{$lookup: {
				from: 'events',
				localField: 'event_key',
				foreignField: 'key',
				as: 'event'
			}},
			{$set: {
				event_label: {$concat: [
					{ $toString: { $arrayElemAt: ['$event.year', 0]}},
					' ',
					{ $arrayElemAt: ['$event.name', 0]},
				]} 
			}},
			{$project: {
				event: 0
			}}
		];
		
		const orgs = await utilities.aggregate('orgs', aggPipeline, {allowCache: true});
		
		const selectedButton = req.query['customer'] || req.cookies['homepageButton']; // Previously-selected "Are you:" button on the homepage
		
		res.render('./index', {
			fulltitle: res.msg('index.fulltitle'),
			orgs: orgs,
			redirectURL: req.getFixedRedirectURL(), //redirectURL for viewer-accessible pages that need an organization to be picked before it can be accessed
			isOrgSelectScreen: true,
			selectedButton: selectedButton
		});
	}
}));

/**
 * User submission to select an organization.
 */
router.all('/selectorg', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'selectorg[all]');
	logger.debug('ENTER');
	
	doSelectOrg(req, res, () => {
		//now, once default user is logged in, redirect to index
		logger.debug('User is now in an org, redirecting');
		
		let redirectURL = req.getRedirectURL();
		
		if (redirectURL) {
			logger.debug(`redirect: ${redirectURL}`);
			if (req.query.alert) {
				// 2022-04-05 JL: Introduced getURLWithQueryParameters so we don't have to worry about ? and & all the time
				redirectURL = req.getURLWithQueryParameters(redirectURL, {alert: req.query.alert});
				// 2022-02-27 JL: fixing alert not showing up on login redirects
				// if (redirectURL.includes('?')) redirectURL += '&alert=' + req.query.alert;
				// else redirectURL += '?alert=' + req.query.alert;
			}
			res.redirect(redirectURL);
		}
		else {
			res.redirect('/home');
		}
	});
}));

router.all('/selectorg-login', wrap(async (req, res) => {
	//http://localhost:3000/?redirectURL=/scouting/pit%3fteam_key=frc58%26foo=bar
	
	logger.addContext('funcName', 'selectorg[all]');
	logger.debug('ENTER');
	
	doSelectOrg(req, res, () => {
		logger.debug('User is now in an org, taking them to the login page');
		
		let redirect = req.getFixedRedirectURL();
		res.redirect(`/user/login?rdr=${redirect}`);
	});
}));

/**
 * Main homepage.
 * @url /
 * @view /index
 */
router.get('/home', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'home[get]');
	logger.debug('ENTER');
	
	let redirect = req.getRedirectURL();
	if (redirect) {
			
		logger.debug(`redirect: ${redirect}`);
		res.redirect(redirect);
	}
	else if (!req.user) res.redirect('/');
	else {
		res.render('./home', { 
			title: res.msg('home.title'),
		});
	}
}));

router.get('/throwanerror', wrap(async (req, res) => {
	logger.addContext('funcName', 'throwanerror[get]');
	
	throw new e.InternalServerError('This was on purpose.');
	
}));

router.get('/usererror', wrap(async (req, res) => {
	logger.addContext('funcName', 'usererror[get]');
	
	throw new e.UserError();
}));

// Moved the select-org process into a helper function so I can do it with the standard selectorg and & one which immediately takes you to the login screen
async function doSelectOrg(req: express.Request, res: express.Response, cb: () => void) {
	
	let org_key = req.body.org_key || req.query.org_key;
	logger.debug(`org_key=${org_key}`);
	
	//Make sure that form is filled
	if(!org_key || org_key == ''){
		logger.debug('Form isn\'t filled, redir. and telling to select an org.');
		return res.redirect('/?alert=' + res.msgUrl('selectOrg'));
	}
	
	//search for organization in database
	let selectedOrg = await utilities.findOne('orgs', 
		{'org_key': org_key}, {},
		{allowCache: true}
	);
	
	//If organization does not exist:
	if(!selectedOrg) {
		//If there is an org_key cookie, remove it
		if (req.cookies.org_key) {
			res.clearCookie('org_key');
		}
		//Redirect to home, without the invalid org_key query parameter
		return res.redirect(`/?redirectURL=${req.getFixedRedirectURL()}`);
	}
	
	//Now, sign in to organization's default user
	let defaultUser = await utilities.findOne<any>('users', 
		{org_key: org_key, name: 'default_user'}, {},
		{allowCache: true}
	);
	logger.debug(`defaultUser=${JSON.stringify(defaultUser)}`);
	
	if(!defaultUser){
		logger.debug('No default user');
		return res.redirect(`/user/switchorg?alert=Error: No default user for organization ${org_key} exists in database.`);
	}
	
	//gotta catch if the person pressed the back button first, then gotta log out before loggin in
	if( req.user ){
		//destroy session then log in to default user
		req.logout(() => {
			doLogin();
		});
		logger.debug('req.user is defined, so we are logging them out first');
	}
	else {
		doLogin();
	}
	
	function doLogin() {	
		//Now, log in to defaultUser
		req.logIn(defaultUser, function(err){
		
			logger.debug('defaultUser logged in');
		
			//set org_key cookie to selected organization
			logger.debug('Setting org_key cookie');
			res.cookie('org_key', org_key, {maxAge: 30E9});
			
			//If error, then log and return an error
			if(err){ logger.error(err); return res.status(500).send({alert: err}); }
		
			cb();
		});
	}
}


module.exports = router;