var express = require('express');
var router = express.Router();

/**
 * TBA Webhooks test
 * @url /webhook
 */
router.get('/webhook', function(req, res){
	console.log("got a get request to webhook");
	console.log(req.query);
	//$2b$05$E5bhUSxNH5nAbrlHVLmyXeohhAngKMqp5pgiN/QBXhadN7dsp8bi.
	res.send(200);
});
 
/**
 * TBA Webhooks test
 * @url (POST) /webhook
 */
router.post('/webhook', function(req, res){
	console.log("got a post request to webhook");
	console.log(req.body);
	//$2b$05$E5bhUSxNH5nAbrlHVLmyXeohhAngKMqp5pgiN/QBXhadN7dsp8bi.
	res.send(200);
});

/**
 * Main homepage.
 * @url /
 * @view /index
 */
router.get('/', function(req, res) {
	
	//Prepare an alert. (Used w/ url /?alert=(alert))
	if(req.query)
		var alert = req.query.alert || null;
	
	req.db.get("currentteams").find({},{sort:{team_number: 1}},function(e, teams){
		
		//If no current teams, then render page without team list.
		if(!teams || !teams[0]){
			res.log(e || "No teams listed yet");
			return res.render('./index', { 
				title: 'Home',
				alert: alert
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
			alert: alert
		});
	});
});

/**
 * Simple logout link. (if I put it in login, url would be /login/logout... and cmon that's silly)
 * @url /logout
 * @redirect /
 */
router.get("/logout", function(req, res) {
	
	//Logs out user with message
	req.logout();
	
	//Redirects user
	res.redirect('/')
});

module.exports = router;