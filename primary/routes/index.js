const express = require('express');
const router = express.Router();
const utilities = require('../utilities');

router.get('/', async function(req, res){
	
	//If there is a logged-in user, that means they HAVE selected an org, and 
	// so then redirect to /home
	if( req.user ){
		
		res.redirect(307, '/home');
	}
	//If user has not selected an org (not logged in), send them to pick-org page.
	else{
		
		res.redirect(307, '/user/selectorg');
	}
	
});

/**
 * Main homepage.
 * @url /
 * @view /index
 */
router.get('/home', async function(req, res) {
	//2019-9-23 JL: Changed post-login index to /home. Uhh this will be 
	// implemented more thoroughly later...
	
	var teams = await utilities.find("currentteams", {}, {sort:{team_number: 1}});
		
	//If no current teams, then render page without team list.
	if(!teams || !teams[0]){
		res.log("No teams listed yet");
		return res.render('./index', { 
			title: 'Home',
		});
	}
	
	//get list of just team numbers
	var teamNumbers = [];
	
	for(var i in teams){
		teamNumbers[i] = teams[i].team_number;
	}
	
	//Render page w/ team list
	res.render('./index', { 
		title: 'Home',
		teamList: teamNumbers,
	});
});

module.exports = router;