var express = require('express');
var router = express.Router();

router.get('/match*', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var thisFuncName = "scouting.match*[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var scoringLayoutCol = db.get("scoringlayout");
	var scoringDataCol = db.get("scoringdata");
	var event_year = req.event.year;
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	var match_team_key = req.query.key;
	var alliance = req.query.alliance;
	
	res.log(`${thisFuncName}- match_team_key: ${match_team_key} alliance: ${alliance} user: ${thisUserName}`);
	
	if (!match_team_key) {
		res.redirect("/dashboard");
		return;
	}
	
	//check if there is already data for this match
	scoringDataCol.find({"year" : event_year, "match_team_key": match_team_key}, {sort: {"order": 1}}, function(e, scoringdata){
		
		//scouting answers for this match are initialized as null for visibility
		var answers = null;
		
		if( scoringdata && scoringdata[0] ){
			
			//if we have data for this match, 
			var data = scoringdata[0].data;
			if(data){
				res.log(`${thisFuncName}- data: ${JSON.stringify(scoringdata[0].data)}`);
				//set answers to data if exists
				answers = data;
			}
			else{
				res.log(`${thisFuncName}- no data for this match`)
			}
		}
		
		//load layout
		scoringLayoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
			var layout = docs;
			//render page
			res.render("./scouting/match", {
				title: "Match Scouting",
				layout: layout,
				key: match_team_key,
				alliance: alliance,
				answers: answers
			});
		});
	});
});

router.post('/match/submit', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	/** We need to do this eventually for security. Commented out of fear that scouters may be logged out while scouting (by accident)
	//auth
	if(!require('./checkauthentication')(req, res))
		return null;usefunct
	*/
	var thisFuncName = "scouting.match[post]: ";
	res.log(thisFuncName + 'ENTER');
	
	if(req.user && req.user.name){
		var thisUser = req.user;
		var thisUserName = thisUser.name;
	}else{
		var thisUser = { name: "Mr. Unknown" };
		var thisUserName = "Mr. Unknown";
	}
	var matchData = req.body;
	if(!matchData)
		return res.send({status: 500, message: "No data was sent to /scouting/match/submit."});
	
	var match_team_key = matchData.match_team_key;
	res.log(thisFuncName + "match_key=" + match_team_key + " ~ thisUserName=" + thisUserName);
	delete matchData.match_key;
	res.log(thisFuncName + "matchData(pre-modified)=" + JSON.stringify(matchData));
	//res.log(thisFuncName + 'match_key=' + match_key + ' ~ thisUserName=' + thisUserName);
	//res.log(thisFuncName + 'matchData=' + JSON.stringify(matchData));

	// Get the 'layout' so we know types of data elements
	var scoreCol = req.db.get("scoringlayout");
	scoreCol.find({}, {sort: {"order": 1}}, function(e, docs){
		var layout = docs;
		var layoutTypeById = {};
		//res.log(thisFuncName + "layout=" + JSON.stringify(layout));
		for (var property in layout) {
			if (layout.hasOwnProperty(property)) {
				//res.log(thisFuncName + layout[property].id + " is a " + layout[property].type);
				layoutTypeById[layout[property].id] = layout[property].type;
			}
		}
	
		// Process input data, convert to numeric values
		for (var property in matchData) {
			var thisType = layoutTypeById[property];
			//res.log(thisFuncName + property + " :: " + matchData[property] + " ~ is a " + thisType);
			if ('counter' == thisType || 'badcounter' == thisType) {
				//res.log(thisFuncName + "...converting " + matchData[property] + " to a number");
				var newVal = -1;
				if (matchData[property]) {
					var parseVal = parseInt(matchData[property]);
					if (!isNaN(parseVal))
						newVal = parseVal;
				}
				matchData[property] = newVal;
			}
			if ('checkbox' == thisType) {
				//res.log(thisFuncName + "...converting " + matchData[property] + " to a boolean 1/0 number");
				var newVal = (matchData[property] == "true" || matchData[property] == true) ? 1 : 0;
				matchData[property] = newVal;
			}
		}
		res.log(thisFuncName + "matchData(UPDATED)=" + JSON.stringify(matchData));
	
		// Post modified data to DB
		var matchCol = req.db.get('scoringdata');
		
		matchCol.update( { "match_team_key" : match_team_key }, { $set: { "data" : matchData, "actual_scorer": thisUserName, useragent: req.shortagent } }, function(e, docs){
			if(e)
				return res.send({status: 500, message: e});
			return res.send({message: "Submitted data successfully.", status: 200});
		});
	});
});

router.post('/submitmatch', function(req, res) {
	//LEGACY CODE
	
	var thisFuncName = "scouting.submitmatch[post]: ";
	res.log(thisFuncName + 'ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	
	//res.log(thisFuncName + 'req.body=' + JSON.stringify(req.body));
	
	var matchData = req.body;
	
	var match_key = matchData.match_key;
	delete matchData.match_key;
	res.log(thisFuncName + 'match_key=' + match_key + ' ~ thisUserName=' + thisUserName);
	res.log(thisFuncName + 'matchData=' + JSON.stringify(matchData));

	var db = req.db;
    var matchCol = db.get('scoringdata');

	matchCol.update( { "match_team_key" : match_key }, { $set: { "data" : matchData, "actual_scorer": thisUserName } }, function(e, docs){
		res.redirect("/dashboard");
	});
});

router.get('/pit*', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;

	//Add event key and pit data to get pit function
	var event_key = req.event.key;
	var event_year = req.event.year;
	
	var thisFuncName = "scouting.pit*[get]: ";
	res.log(thisFuncName + 'ENTER');

	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/dashboard");
		return;
	}

	var db = req.db;
	var scoutCol = db.get("scoutinglayout");
	var pitCol = req.db.get('scoutingdata'); //for pitcol.find()
	
	
	scoutCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
		var layout = docs;

		//pasted code
		pitCol.find({ "event_key" : event_key, "team_key" : teamKey }, {}, function(e, docs){
			var pitData = null;
			if (docs && docs[0])
				if (docs[0].data)
					pitData = docs[0].data;

			//res.log(layout);
			res.render("./scouting/pit", {
				title: "Pit Scouting",
				layout: layout,
				pitData: pitData, 
				key: teamKey
			});
		});
	});
});

router.post('/pit/submit', async function(req, res){
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var thisFuncName = "scouting.submitpit[post]: ";
	res.log(thisFuncName + 'ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	
	//res.log(thisFuncName + 'req.body=' + JSON.stringify(req.body));
	
	var pitData = req.body;
	res.log(req.body);
	var teamKey = pitData.teamkey;
	delete pitData.teamkey;
	res.log(thisFuncName + 'teamKey=' + teamKey + ' ~ thisUserName=' + thisUserName);
	res.log(thisFuncName + 'pitData=' + JSON.stringify(pitData));

	var db = req.db;
    var pitCol = db.get('scoutingdata');

	var event_key = req.event.key;

	//res.redirect("/dashboard");
	
	pitCol.update( { "event_key" : event_key, "team_key" : teamKey }, { $set: { "data" : pitData, "actual_scouter": thisUserName, useragent: req.shortagent } }, function(e, docs){
		if(e)
			return res.send({status: 500, message: e});
		return res.send({message: "Submitted data successfully.", status: 200});
	});
});

router.post('/submitpit', function(req, res) {
	//LEGACY CODE
	var thisFuncName = "scouting.submitpit[post]: ";
	res.log(thisFuncName + 'ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	
	//res.log(thisFuncName + 'req.body=' + JSON.stringify(req.body));
	
	var pitData = req.body;
	
	var teamKey = pitData.teamkey;
	delete pitData.teamkey;
	res.log(thisFuncName + 'teamKey=' + teamKey + ' ~ thisUserName=' + thisUserName);
	res.log(thisFuncName + 'pitData=' + JSON.stringify(pitData));

	var db = req.db;
    var pitCol = db.get('scoutingdata');
	var event_key = req.event.key;
	
	pitCol.update( { "event_key" : event_key, "team_key" : teamKey }, { $set: { "data" : pitData, "actual_scouter": thisUserName } }, function(e, docs){
		res.redirect("/dashboard");
	});
});

//For \views\scouting\teampictures.pug
router.get('/teampictures', async function(req, res) {
	//Check authentication for scouter level
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;

	var thisFuncName = "scouting.teampictures[get]: ";
		res.log(thisFuncName + 'ENTER');
		
		var db = req.db;
		var teamCol = db.get("currentteams");
		
		var event_year = req.event.year;

		teamCol.find({}, {sort: {team_number: 1}}, function(e, docs) {
			var teams = [];
			if (docs && docs.length > 0)
				teams = docs;
			var fs = require("fs");
			var path = require("path");
			var UPLOAD_PATH = path.resolve(__dirname, '..', process.env.AVATAR_STORAGE) + "\\";
			for (var i = 0; i < teams.length; i++) {
				var team = teams[i];
					//console.log(`${UPLOAD_PATH}\\responsive\\${event_year}_${team.key}_sm.jpg`);
				if (fs.existsSync(`${UPLOAD_PATH}\\responsive\\${event_year}_${team.key}_sm.jpg`)) {
					teams[i].hasPicture = true;
				}
				else {teams[i].hasPicture = false;}
			}
			//res.log(thisFuncName + 'rankings=' + JSON.stringify(rankings));
			
			res.render("./scouting/teampictures", {
				title: "Team Pictures",
				teams: teams
			});
		});
});

router.get('/', function(req, res){
	
	//redirect to pits dashboard
	res.redirect('/dashboard/pits');
});

module.exports = router;