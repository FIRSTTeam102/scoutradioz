const express = require('express');
const router = express.Router();
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
	else{
		
		//Get list of participating organizations.
		var orgs = await utilities.find("orgs");
		
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
 * POST: User submission to select an organization.
 */
router.post('/selectorg', async function(req, res) {
	
	var org_key = req.body.org_key;
	
	//Make sure that form is filled
	if(!org_key || org_key == ""){
		res.log("Form isn't filled, redir. and telling to select an org.");
		return res.redirect('/?alert=Please select an organization.');
	}
	
	//search for organization in database
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.redirect(500, '/');
	
	//Now, sign in to organization's default user
	var defaultUser = await utilities.findOne("users", {org_key: org_key, name: "default_user"});
	
	if(!defaultUser){
		res.log("No default user")
		return res.redirect(`/?alert=Error: No default user for organization ${org_key} exists in database.`);
	}
	
	//gotta catch if the person pressed the back button first, then gotta log out before loggin in
	if( req.user ){
		//destroy session then log in to default user
		req.logout();
	}
				
	//Now, log in to defaultUser
	req.logIn(defaultUser, function(err){
			
		//If error, then log and return an error
		if(err){ console.error(err); return res.status(500).send({alert: err}) };
		
		//now, once default user is logged in, redirect to index
		res.log("User is now logged in, redirecting to /home");
		
		if( req.body.redirectURL ){
			res.redirect(req.body.redirectURL);
		}else{
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
	
	if( !req.user ){
		res.redirect('/?alert=Please choose an organization.');
	}
	
	
	var teams = await utilities.find("currentteams", {}, {sort:{team_number: 1}});
		
	//If no current teams, then render page without team list.
	if(!teams || !teams[0]){
		res.log("No teams listed yet");
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