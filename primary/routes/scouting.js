const router = require("express").Router();
const logger = require('log4js').getLogger();
const utilities = require('../utilities');
const matchDataHelper = require ('../helpers/matchdatahelper');
const uploadHelper = require('../helpers/uploadhelper');

router.all('/*', async (req, res, next) => {
	//Require scouter-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_SCOUTER)) {
		next();
	}
})

router.get('/match*', async function(req, res) {
	
	var thisFuncName = "scouting.match*[get]: ";
	logger.info(thisFuncName + 'ENTER');
	
	// var scoringLayoutCol = db.get("scoringlayout");
	// var scoringDataCol = db.get("scoringdata");

	var event_year = req.event.year;
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	var match_team_key = req.query.key;
	var alliance = req.query.alliance;
	var org_key = req.user.org_key;
	
	logger.debug(`${thisFuncName}- match_team_key: ${match_team_key} alliance: ${alliance} user: ${thisUserName}`);
	
	if (!match_team_key) {
		res.redirect("/dashboard");
		return;
	}
	
	//check if there is already data for this match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scoringdata = await utilities.find("matchscouting", {"org_key": org_key, "year" : event_year, "match_team_key": match_team_key}, {sort: {"order": 1}});
		
	//scouting answers for this match are initialized as null for visibility
	var answers = null;
	
	if( scoringdata && scoringdata[0] ){
		
		//if we have data for this match, 
		var data = scoringdata[0].data;
		if(data){
			logger.debug(`${thisFuncName}- data: ${JSON.stringify(scoringdata[0].data)}`);
			//set answers to data if exists
			answers = data;
		}
		else{
			logger.debug(`${thisFuncName}- no data for this match`)
		}
	}
	
	//load layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var layout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find("layout", {org_key: org_key, year: parseInt(event_year), form_type: "matchscouting"}, {sort: {"order": 1}})

	//render page
	res.render("./scouting/match", {
		title: "Match Scouting",
		layout: layout,
		key: match_team_key,
		alliance: alliance,
		answers: answers
	});
});

router.post('/match/submit', async function(req, res) {
	
	var thisFuncName = "scouting.match[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
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
	
	var event_year = req.event.year;
	var match_team_key = matchData.match_team_key;
	var org_key = req.user.org_key;

	logger.debug(thisFuncName + "match_key=" + match_team_key + " ~ thisUserName=" + thisUserName);
	delete matchData.match_key;
	logger.debug(thisFuncName + "matchData(pre-modified)=" + JSON.stringify(matchData));
	//logger.debug(thisFuncName + 'match_key=' + match_key + ' ~ thisUserName=' + thisUserName);
	//logger.debug(thisFuncName + 'matchData=' + JSON.stringify(matchData));

	// Get the 'layout' so we know types of data elements
	// var scoreCol = db.get("scoringlayout");
	// var matchCol = db.get('scoringdata');

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var layout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find("layout", {org_key: org_key, year: parseInt(event_year), form_type: "matchscouting"}, {sort: {"order": 1}})

	var layoutTypeById = {};
	//logger.debug(thisFuncName + "layout=" + JSON.stringify(layout));
	for (var property in layout) {
		if (layout.hasOwnProperty(property)) {
			//logger.debug(thisFuncName + layout[property].id + " is a " + layout[property].type);
			layoutTypeById[layout[property].id] = layout[property].type;
		}
	}

	// Process input data, convert to numeric values
	for (var property in matchData) {
		var thisType = layoutTypeById[property];
		//logger.debug(thisFuncName + property + " :: " + matchData[property] + " ~ is a " + thisType);
		if ('counter' == thisType || 'badcounter' == thisType) {
			//logger.debug(thisFuncName + "...converting " + matchData[property] + " to a number");
			var newVal = -1;
			if (matchData[property]) {
				var parseVal = parseInt(matchData[property]);
				if (!isNaN(parseVal))
					newVal = parseVal;
			}
			matchData[property] = newVal;
		}
		if ('checkbox' == thisType) {
			//logger.debug(thisFuncName + "...converting " + matchData[property] + " to a boolean 1/0 number");
			var newVal = (matchData[property] == "true" || matchData[property] == true) ? 1 : 0;
			matchData[property] = newVal;
		}
	}
	logger.debug(thisFuncName + "matchData(UPDATED:1)=" + JSON.stringify(matchData));

	// Calculate derived metrics [SEE ALSO INDEXADMIN.JS]
	// read in the 'derived' metrics from the matchscouting layout, use to process data
	var derivedLayout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "matchscouting", type: "derived"}, {sort: {"order": 1}})

	for (var j in derivedLayout) {
		var thisItem = derivedLayout[j];

		var derivedMetric = NaN;
		switch (thisItem.operator) {
			case "sum":
				// add up the operands
				var sum = 0;
				for (var metricId in thisItem.operands)
					sum += matchData[thisItem.operands[metricId]];
				derivedMetric = sum;
				break;
		}
		matchData[thisItem.id] = derivedMetric;
	}
	logger.debug(thisFuncName + "matchData(UPDATED:2)=" + JSON.stringify(matchData));

	// Post modified data to DB
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.update("matchscouting", { "org_key": org_key, "match_team_key" : match_team_key }, { $set: { "data" : matchData, "actual_scorer": thisUserName, useragent: req.shortagent } });

	return res.send({message: "Submitted data successfully.", status: 200});
});

router.get('/pit*', async function(req, res) {
	
	var uploadURL = process.env.UPLOAD_URL + "/" + process.env.TIER + "/image";
	
	//Add event key and pit data to get pit function
	var event_key = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;
	
	var thisFuncName = "scouting.pit*[get]: ";
	logger.info(thisFuncName + 'ENTER');

	var teamKey = req.query.team;
	if (!teamKey) {
		res.redirect("/dashboard");
		return;
	}
	
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var layout = await utilities.find("scoutinglayout", { "year": event_year }, {sort: {"order": 1}});
	var layout = await utilities.find("layout", {org_key: org_key, year: event_year, form_type: "pitscouting"}, {sort: {"order": 1}})
	
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var pitFind = await utilities.find("pitscouting", { "org_key": org_key, "event_key" : event_key, "team_key" : teamKey }, {});
	var pitData = null;
	if (pitFind && pitFind[0])
		if (pitFind[0].data)
			pitData = pitFind[0].data;
	
	const images = await uploadHelper.findTeamImages(org_key, event_year, teamKey);
	
	res.render("./scouting/pit", {
		title: "Pit Scouting",
		layout: layout,
		pitData: pitData, 
		key: teamKey,
		uploadURL: uploadURL,
		images: images
	});
});

router.post('/pit/submit', async function(req, res){
	
	var thisFuncName = "scouting.submitpit[post]: ";
	logger.info(thisFuncName + 'ENTER');
	
	var thisUser = req.user;
	var thisUserName = thisUser.name;
	
	//logger.debug(thisFuncName + 'req.body=' + JSON.stringify(req.body));
	
	var pitData = req.body;
	logger.debug(req.body);
	var teamKey = pitData.teamkey;
	delete pitData.teamkey;
	logger.debug(thisFuncName + 'teamKey=' + teamKey + ' ~ thisUserName=' + thisUserName);
	logger.debug(thisFuncName + 'pitData=' + JSON.stringify(pitData));

    // var pitCol = db.get('scoutingdata');

	var event_key = req.event.key;
	var org_key = req.user.org_key;

	//res.redirect("/dashboard");

	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	await utilities.update("pitscouting", { "org_key": org_key, "event_key" : event_key, "team_key" : teamKey }, { $set: { "data" : pitData, "actual_scouter": thisUserName, useragent: req.shortagent } });

	return res.send({message: "Submitted data successfully.", status: 200});
});

//For \views\scouting\teampictures.pug
router.get('/teampictures', async function(req, res) {

	var thisFuncName = "scouting.teampictures[get]: ";

	logger.info(thisFuncName + 'ENTER');
	
	// var teamCol = db.get("currentteams");
	
	var event_year = req.event.year;
	var event_key = req.event.key;

	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	//var teams = await utilities.find("currentteams", {}, {sort: {team_number: 1}});
	var thisEventData = await utilities.find("events", {"key": event_key});
	var thisEvent = thisEventData[0];
	var teams = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0)
	{
		logger.debug(thisFuncName + "thisEvent.team_keys=" + JSON.stringify(thisEvent.team_keys));
		teams = await utilities.find("teams", {"key": {$in: thisEvent.team_keys}}, {sort: {team_number: 1}})
	}
	
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
	//logger.debug(thisFuncName + 'rankings=' + JSON.stringify(rankings));
	
	res.render("./scouting/teampictures", {
		title: "Team Pictures",
		teams: teams
	});
});

router.get('/', async function(req, res){
	
	//redirect to pits dashboard
	res.redirect('/dashboard/pits');
});

module.exports = router;