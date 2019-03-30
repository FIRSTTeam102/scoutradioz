var express = require('express');
var router = express.Router();

/**
 * Manual input for correcting each match, if TBA is not accessible.
 * @url /manualinput/matches
 * @
 */
router.get('/matches', function(req, res) {
	
	var thisFuncName = "manualinputs.matches[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var matchCol = req.db.get('matches');
	
	var event_key = req.event.key;
	res.log(thisFuncName + 'event_key=' + event_key);

	// Match history info
	//matchCol.find({"alliances.red.score": { $ne: -1}, "event_key" : event_key}, {sort: {time: -1}}, function (e, docs) {
	matchCol.find({"event_key" : event_key}, {sort: {time: 1}}, function (e, docs) {
		var matches = docs;
		
		res.render("./manualinputs/matches", {
			title: "Matches",
			matches: matches
		});
	});	
	
//res.send('Hello World')
});

/** POST method for 
 * 
 */
router.post('/matches', function(req, res){
	res.send(req.body);
});
module.exports = router 