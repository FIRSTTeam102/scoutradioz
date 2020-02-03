const router = require('express').Router();
const utilities = require('../utilities');
const logger = require('log4js').getLogger();

/**
 * The "index" page that loads is now a form to select an organization.
 */
router.get('/', async function(req, res){
	
	//If there is a logged-in user, that means they HAVE selected an org, and 
	// so then redirect to /home
	//If user has not selected an org (not logged in), send them to pick-org page.
	if( req.user ){
		
		//added originalUrl to make GET queries to persist (for alert)
		res.redirect(307, '/home' + req.originalUrl);
	}
	else if ( req.cookies.org_key ){
		
		//redirect to selectorg with the selected org_key to sign in to the org user
		res.redirect(307, `/selectorg?org_key=${req.cookies.org_key}&redirectURL=${req.originalUrl}`)
	}
	else{
		
		//Get list of participating organizations.
		var orgs = await utilities.find("orgs", {}, {sort: {org_key: 1}});
		logger.trace(JSON.stringify(orgs));
		
		//redirectURL for viewer-accessible pages that need an organization to be picked before it can be accessed
		var redirectURL = req.query.redirectURL;
		if( redirectURL == "undefined" ) redirectURL = undefined;
		
		res.render('./index', {
			title: "Select an Organization",
			orgs: orgs,
			redirectURL: redirectURL
		});
	}
});

/**
 * User submission to select an organization.
 */
router.all('/selectorg', async function(req, res) {
	
	const thisFuncName = 'index/selectorg: ';
	
	var org_key = req.body.org_key || req.query.org_key;
	logger.debug(`${thisFuncName} org_key=${org_key}`)
	
	//Make sure that form is filled
	if(!org_key || org_key == ""){
		logger.debug("Form isn't filled, redir. and telling to select an org.");
		return res.redirect('/?alert=Please select an organization.');
	}
	
	//search for organization in database
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.redirect(500, '/');
	
	//Now, sign in to organization's default user
	var defaultUser = await utilities.findOne("users", {org_key: org_key, name: "default_user"});
	logger.debug(`${thisFuncName} defaultUser=${JSON.stringify(defaultUser)}`);
	
	if(!defaultUser){
		logger.debug("No default user")
		return res.redirect(`/?alert=Error: No default user for organization ${org_key} exists in database.`);
	}
	
	//gotta catch if the person pressed the back button first, then gotta log out before loggin in
	if( req.user ){
		//destroy session then log in to default user
		req.logout();
		logger.debug(`${thisFuncName} req.user is defined, so we are logging them out first`);
	}
				
	//Now, log in to defaultUser
	req.logIn(defaultUser, function(err){
		
		logger.debug(`${thisFuncName} defaultUser logged in`)
		
		//set org_key cookie to selected organization
		logger.debug(`${thisFuncName} Setting org_key cookie`)
		res.cookie("org_key", org_key);
			
		//If error, then log and return an error
		if(err){ console.error(err); return res.status(500).send({alert: err}) };
		
		//now, once default user is logged in, redirect to index
		logger.debug(`${thisFuncName} User is now logged in, redirecting`);
		
		if (req.body.redirectURL || req.query.redirectURL) {
			
			logger.debug(`${thisFuncName} redirect: ${req.body.redirectURL || req.query.redirectURL}`);
			res.redirect(req.body.redirectURL || req.query.redirectURL);
		}
		else {
			res.redirect('/home');
		}
	});
});

/**
 * Main homepage.
 * @url /
 * @view /index
 */
router.get('/home', async function(req, res) {
	
	if (!req.user) res.redirect('/');
	
	var teams = await utilities.find("currentteams", {}, {sort:{team_number: 1}});
		
	//If no current teams, then render page without team list.
	if(!teams || !teams[0]){
		logger.debug("No teams listed yet");
		return res.render('./home', { 
			title: 'Home',
		});
	}
	
	//get list of just team numbers
	var teamNumbers = [];
	
	for(var i in teams){
		teamNumbers[i] = teams[i].team_number;
	}
	
	//Render page w/ team list
	res.render('./home', { 
		title: 'Home',
		teamList: teamNumbers,
	});
});

module.exports = router;