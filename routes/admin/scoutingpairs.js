var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');

router.get("/", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "scoutingpairs root: ";
	
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");
	
	var db = req.db;
	
	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
	//Gets collection (aka a "table") from db
	var collection = db.get("teammembers");
	
	var progTeam;
	var mechTeam;
	var elecTeam;
	var assigned;

	//Searches for and sets variables for each subteam.
	//Each subteam var is an array with team member names inside.
	collection.find({"subteam":"prog","present":"true","assigned":"false"}, {sort: {"name": 1}}, function(e, docs){
		
		if(e){ //if error, log to console
			res.log(thisFuncName + e);
		}
		progTeam = docs;
		
		collection.find({"subteam":"mech","present":"true","assigned":"false"}, {sort: {"name": 1}}, function(e, docs){
			if(e){ //if error, log to console
				res.log(thisFuncName + e);
			}
			mechTeam = docs;
			
			collection.find({"subteam":"elec","present":"true","assigned":"false"}, {sort: {"name": 1}}, function(e, docs){
				if(e){ //if error, log to console
					res.log(thisFuncName + e);
				}
				elecTeam = docs;
				
				//Gets the current set of already-assigned pairs
				var collection2 = db.get("scoutingpairs");
				collection2.find({}, {}, function (e, docs) {;
					if(e){ //if error, log to console
						res.log(thisFuncName + e);
					}
					assigned = docs;

					// 2018-04-03, M.O'C - Adding in set of "present but not assigned" people
					collection.find({"assigned": "false", "present": "true"}, {sort: {"name": 1}}, function(e, docs) {
						if(e){ //if error, log to console
							res.log(thisFuncName + e);
						}
						available = docs;
					
						//Renders page through Jade.
						res.log(thisFuncName + "RENDERING");
						
						res.render("./admin/scoutingpairs", {
							title: "Scouting Pairs",
							prog: progTeam,
							mech: mechTeam,
							elec: elecTeam,
							assigned: assigned,
							available: available
						});
					});
				});
			});
		});
	});
	
	res.log(thisFuncName + "DONE");
});

/* POST to Set scoutingPair Service */
router.post('/setscoutingpair', function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "setscoutingpair: ";
	
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");

    // Set our internal DB variable
    var db = req.db;

	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
    // Get our form values. These rely on the "name" attributes of form elements (e.g., named 'data' in the form)
    var data = req.body.data;
    //res.log(thisFuncName + data);
	
	// The javascript Object was JSON.stringify() on the client end; we need to re-hydrate it with JSON.parse()
	var selectedMembers = JSON.parse(data);
	res.log(selectedMembers);
	//var insertArray = [];
	//insertArray["pair"] = selectedMembers;

	////// Update selected teams to reflect the newly-picked team
	
    // Set collection to 'scoutingpairs'
    var collection = db.get('scoutingpairs');
	
	// Submit to the DB
	collection.insert(selectedMembers);
	
	////// Update members in 'teammembers' so that they're marked as "assigned" (and won't be available to choose afterwards)
	
    // Set collection to 'teammembers'
    var collection = db.get('teammembers');

	// TODO: Redo as... teamCol.bulkWrite([{updateMany:{filter:{ "name": {$in: nameList }}, update:{ $set: { "assigned" : "true" } }}}], function(e, docs){
    // Submit to the DB
	for (var member in selectedMembers)
	{
		res.log(selectedMembers[member]);
		collection.update(
			{ "name" : selectedMembers[member] },
			{ $set: { "assigned" : "true" } }
		)
	}
	
	res.log(thisFuncName + "REDIRECT");
	res.redirect("./");
	
	res.log(thisFuncName + "DONE");
});

router.post("/deletescoutingpair", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "deletescoutingpair: ";
	
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");
	
	var db = req.db;
	
	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
	var data = req.body.data;
	
	var scoutCol = db.get("scoutingpairs");
	
	scoutCol.find({"_id": data}, {}, function(e, docs){
		
		if(e){ //if error, log to console
			res.log(thisFuncName + e);
		}
		thisPair = docs[0];
		res.log("thisPair=" + JSON.stringify(thisPair));

		var teamCol = db.get('teammembers');

		var nameList = [];
		if (thisPair.member1)
			nameList.push(thisPair.member1);
		if (thisPair.member2)
			nameList.push(thisPair.member2);
		if (thisPair.member3)
			nameList.push(thisPair.member3);
		res.log("nameList=" + JSON.stringify(nameList));

		teamCol.bulkWrite([{updateMany:{filter:{ "name": {$in: nameList }}, update:{ $set: { "assigned" : "false" } }}}], function(e, docs){
			scoutCol.remove({"_id": data}, function(e, docs) {
				res.log(thisFuncName + "REDIRECT");
				res.redirect("./");	
			});
		});
	});
	
	res.log(thisFuncName + "DONE");
});

router.post("/generateteamallocations", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	var passCheckSuccess;
	
	//override if dev
	if( req.app.isDev ){
		generateTeamAllocations(req, res);
	}
	else{
			
		if( !req.body.password || req.body.password == ""){
			
			return res.send({status: 401, alert: "No password entered."});
		}
		if( !require('../checkauthentication')(req, res, 'admin') )
			return res.log('admin not logged in on generateteamallocations');
		
		var teammembers = req.db.get('teammembers');
		
		teammembers.find( { name: req.user.name }, {}, function( e, user ){
			if(e)
				return console.error(e);
			if(!user[0]){
				res.send({status: 500, alert:"Passport error: no user found in db?"});
				return console.error("no user found? generateteamallocations");
			}
			
			bcrypt.compare( req.body.password, user[0].password, function(e, out){
				if(e)
					return console.error(e);
				if(out == true)
					passCheckSuccess = true;
				else
					return res.send({status: 401, alert: "Password incorrect."});
				
				if(passCheckSuccess){
					generateTeamAllocations(req, res);
				}
			});
		});
	}
});	

//////////// Match allocating by batches of matches

router.post("/generatematchallocations2", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "scoutingpairs.generateMATCHallocations2[post]: ";

	// HARDCODED
	var activeTeamKey = 'frc102';
	
	// Gap between matches equal to or over this value means a "major" gap (e.g., lunch, overnight, etc.)
	var matchGapBreakThreshold = 30 * 60;  // 30 minutes, in seconds
	// Size of match blocks to be scouted - scouts will do this many matches in a row
	var matchBlockSize = 5;  // default
	res.log(thisFuncName + 'req.body.blockSize=' + req.body.blockSize);
	if (req.body.blockSize)
	{
		matchBlockSize = req.body.blockSize;
		console.log(thisFuncName + 'Overriding matchBlockSize to ' + matchBlockSize);
		// remove from req.body before proceeding to pulling out the multi-checkbox list
		req.body.blockSize = null;
	}
	
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");

	var availableArray = [];
	res.log(thisFuncName + '*** Tagged as available:');
	for(var i in req.body) {
		res.log(thisFuncName + i);
		availableArray.push(i);
	}

	// used when writing data to DB, for later querying by year
	// 2019-01-23, M.O'C: See YEARFIX comment above
	//var year = (new Date()).getFullYear();
							
	var db = req.db;
	var currentCol = db.get("current");
	var scoutPairCol = db.get("scoutingpairs");
	var memberCol = db.get("teammembers");
	var scoutDataCol = db.get("scoutingdata");
	var scoreDataCol = db.get("scoringdata");
	var matchCol = db.get("matches");

	if(db._state == 'closed'){ //If database does not exist, send error
		return res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}

	// nodeclient
	var Client = require('node-rest-client').Client;
	var client = new Client();
	var args = {
		headers: { "accept": "application/json", "X-TBA-Auth-Key": "iSpbq2JH2g27Jx2CI5yujDsoKYeC8pGuMw94YeK3gXFU6lili7S2ByYZYZOYI3ew" }
	}
		
	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			return res.render('./admin/admin', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// used when writing data to DB, for later querying by event_key
		var event_key = eventId;

		// 2019-01-23, M.O'C: See YEARFIX comment above
		var year = parseInt(event_key.substring(0,4));
						
		// { year, event_key, match_key, match_number, alliance, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }

		//
		// Need map of team IDs to scouts (scoutingdata)
		//
		scoutDataCol.find({"event_key": event_key}, function(e, docs) {
			if(e){ //if error, log to console
				res.log(thisFuncName + e);
			}
			var scoutDataArray = docs;
			
			// Build teamID->primary/secondar/tertiary lookup
			var scoutDataByTeam = {};
			var scoutDataLen = scoutDataArray.length;
			for (var i = 0; i < scoutDataLen; i++) {
				scoutDataByTeam[scoutDataArray[i].team_key] = scoutDataArray[i];
				//res.log(thisFuncName + "Scout data: For team " + scoutDataArray[i].team_key + ", array is " + JSON.stringify(scoutDataArray[i]));
			}

			//
			// Read all assigned OR tagged members, ordered by 'seniority' ~ have an array ordered by seniority
			//
			memberCol.find({$or: [{"name": {$in: availableArray}}, {"assigned": "true"}]}, { sort: {"seniority": 1, "subteam": 1, "name": 1} }, function(e, docs) {
				if(e){ //if error, log to console
					res.log(thisFuncName + e);
				}
				// - matchscouts is the "queue"; need a pointer to indicate where we are
				var matchScouts = docs;
				var matchScoutsLen = matchScouts.length;
				res.log(thisFuncName + "*** Assigned + available, by seniority:");
				for (var i = 0; i < matchScoutsLen; i++)
					res.log(thisFuncName + "member["+i+"] = " + matchScouts[i].name);

				// who is "first" in line in the 'queue'
				var nextMatchScout = 0;
	
				//
				// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
				//
				matchCol.find({ event_key: eventId, "alliances.red.score": -1 },{sort: {"time": 1}}, function(e, docs){

					// Avoid crashing server if all matches at an event are done
					var earliestTimestamp = 9999999999;
					if (docs && docs[0]) {
						var earliestMatch = docs[0];
						earliestTimestamp = earliestMatch.time;
					}

					// Clear 'assigned_scorer', 'data' from all unresolved team@matches ('data' is just in case)
					scoreDataCol.bulkWrite([{updateMany:{filter:{ "event_key": eventId, "time": { $gte: earliestTimestamp } }, update:{ $unset: { "assigned_scorer" : "", "data": "" } }}}], function(e, docs){
					
						// Get list of matches from latest unresolved onward
						//scoreDataCol.find({"event_key": eventId, "assigned_scorer": thisUserName, "time": { $gte: earliestTimestamp }}, { limit: 10, sort: {"time": 1} }, function (e, docs) {
						matchCol.find({"event_key": eventId, "time": { $gte: earliestTimestamp }}, { sort: {"time": 1}}, function (e, docs) {
							var comingMatches = docs;
							var lastMatchTimestamp = earliestTimestamp;
							
							var matchBlockCounter = matchBlockSize;  // initialize at the max size so in the first loop iteration, it'll set up the scout list
							var scoutPointer = 0;  // start off with the 0th position
							var scoutArray = [];  // the current set of scouts (gets regenerated every N matches)
							var scoutAvailableMap = {};  // pool of available scouts
							
							var redBlueToggle = 0;  // flips between 0 and 1, signals whether to allocate red alliance or blue alliance first
							
							for (var matchesIdx = 0; matchesIdx < comingMatches.length; matchesIdx++) {
								var thisMatchKey = comingMatches[matchesIdx].key;
								
								var teamScoutMap = {};  // map of team->scout associations; reset for each match
								
								// Work in sets of up to 5 matches {could be less than 5, if "break" or end is hit}
								if (matchBlockCounter >= matchBlockSize) {
									// Pull off the next 6 scouts
									scoutArray = [];
									for (var i = 0; i < 6; i++) {
										scoutArray.push(matchScouts[scoutPointer].name);
										scoutPointer++;
										if (scoutPointer >= matchScoutsLen)
											scoutPointer = 0;
									}
									res.log(thisFuncName + "Updated current scouts: " + JSON.stringify(scoutArray));
									
									matchBlockCounter = 0;
								}
								matchBlockCounter++;
								
								// reset the scout available map
								scoutAvailableMap = {};
								for (var i = 0; i < 6; i++)
									scoutAvailableMap[scoutArray[i]] = scoutArray[i];
								
								
								var matchGap = comingMatches[matchesIdx].time - lastMatchTimestamp;
								// Iterate until a "break" is found (or otherwise, if the loop is exhausted)
								if (matchGap > matchGapBreakThreshold) {
									res.log(thisFuncName + "matchGap=" + matchGap + "... found a break");
									break;
								}
								
								//res.log(thisFuncName + "comingMatch[" + matchesIdx + "]: matchGap=" + (matchGap) + ", redteams=" + JSON.stringify(comingMatches[matchesIdx].alliances.red.team_keys) + ", blueteams=" + JSON.stringify(comingMatches[matchesIdx].alliances.blue.team_keys));
								var teamArray = [];
								var teamScoutMatchMap = {};
								if (redBlueToggle == 0)
									for (var i = 0; i < 3; i++) {
										teamArray.push(comingMatches[matchesIdx].alliances.red.team_keys[i]);
										teamArray.push(comingMatches[matchesIdx].alliances.blue.team_keys[i]);
									}
								else
									for (var i = 0; i < 3; i++) {
										teamArray.push(comingMatches[matchesIdx].alliances.blue.team_keys[i]);
										teamArray.push(comingMatches[matchesIdx].alliances.red.team_keys[i]);
									}
								res.log(thisFuncName + "comingMatch[" + matchesIdx + "]: matchGap=" + (matchGap) + ", teamArray=" + JSON.stringify(teamArray));
								
								// -- In each match, assign 6 scouts to 6 teams in 'scoringdata'
								// *** PUZZLE: How to do team preferential assignment?
								// * Cycle through - attempt to assign teams to primary (if not yet assigned) ~ pseudorandom? sort { time: 1, _id: 1 }
								// * Cycle through remaining teams - assigning remaining scouts
								// --- Update scoringdata, set assigned_scorer where team_key, match_key, etc.

								// Go through assigning primaries first, then secondaries, then tertiaries
								var roleArray = [ "primary", "secondary", "tertiary" ];
								for (var roleIdx = 0; roleIdx < roleArray.length; roleIdx++) {
									// Which role (primary? secondary? tertiary?) are we checking
									var thisRole = roleArray[roleIdx];

									// Cycle through teams
									for (var i = 0; i < 6; i++) {
										var thisTeamKey = teamArray[i];
										// Assigned yet? If not...
										if (teamScoutMap[thisTeamKey] == null) {
											// Who is assigned to this team?
											var thisScoutData = scoutDataByTeam[thisTeamKey];
											var thisPossibleAssignee = thisScoutData[thisRole];
											//res.log(thisFuncName + ">> Comparing: " + thisTeamKey + ", for role " + thisRole + " is " + thisPossibleAssignee);
											
											// Are they available?
											if (thisPossibleAssignee != null && scoutAvailableMap[thisPossibleAssignee] != null) {
												// Assign them!
												//res.log(thisFuncName + "** Assigning " + thisPossibleAssignee + " to " + thisTeamKey);
												teamScoutMap[thisTeamKey] = thisPossibleAssignee;
												// Take assignee out of available
												delete scoutAvailableMap[thisPossibleAssignee];
											}
										}
									}
								}
								
								// fill in the rest
								var leftoverScouts = [];
								for (var property in scoutAvailableMap)
									if (scoutAvailableMap.hasOwnProperty(property))
										leftoverScouts.push(scoutAvailableMap[property]);
								//res.log(thisFuncName + "leftover scouts are " + JSON.stringify(leftoverScouts));

								// cycle through teams, find the ones without assignees
								var leftoverPointer = 0;
								for (var i = 0; i < 6; i++) {
									var thisTeamKey = teamArray[i];
									// Assigned yet? If not...
									if (teamScoutMap[thisTeamKey] == null) {
										// Grab the next available scout & increment the pointer
										teamScoutMap[thisTeamKey] = leftoverScouts[leftoverPointer];
										leftoverPointer++;
									}
								}

								// show all the team-scout assignments
								for (var property in teamScoutMap) {
									if (teamScoutMap.hasOwnProperty(property)) {
										// Write the assignment to the DB!
										var thisMatchTeamKey = thisMatchKey + "_" + property;
										var thisScout = teamScoutMap[property];
										
										scoreDataCol.update(
											{ "match_team_key" : thisMatchTeamKey },
											{ $set: { "assigned_scorer" : thisScout } }
										)
										//res.log(thisFuncName + "Assigned " + thisMatchTeamKey + " to " + thisScout);
									}
								}									
								
								// update the 'lastMatchTimestamp' so we can track until a break
								lastMatchTimestamp = comingMatches[matchesIdx].time;
							}

							// all done, go to the matches list
							res.redirect("/dashboard/matches");
						});
					});
				});
			});
		});
	});
});

router.post("/clearmatchallocations", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var passCheckSuccess;
	
	if( !req.body.password || req.body.password == ""){
		return res.send({status: 401, alert: "No password entered."});
	}
	if( !require('../checkauthentication')(req, res, 'admin') )
		return res.log('admin not logged in on generateteamallocations');
	
	var teammembers = req.db.get('teammembers');
	
	teammembers.find( { name: req.user.name }, {}, function( e, user ){
		if(e)
			return console.error(e);
		if(!user[0]){
			res.send({status: 500, alert:"Passport error: no user found in db?"});
			return console.error("no user found? generateteamallocations");
		}
		
		bcrypt.compare( req.body.password, user[0].password, function(e, out){
			if(e)
				return console.error(e);
			if(out == true)
				passCheckSuccess = true;
			else
				return res.send({status: 401, alert: "Password incorrect."});
			
			if(passCheckSuccess){
/* Begin regular code ----------------------------------------------------------- */
	
	var thisFuncName = "scoutingpairs.clearMATCHallocations[post]: ";

	// used when writing data to DB, for later querying by year
	// 2019-01-23, M.O'C: See YEARFIX comment above
	//var year = (new Date()).getFullYear();
							
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");
	
	var db = req.db;
	var currentCol = db.get("current");
	var scoreDataCol = db.get("scoringdata");

	if(db._state == 'closed'){ //If database does not exist, send error
		return res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}

	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			return res.render('./admin/admin', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		var event_key = eventId;

		// 2019-01-23, M.O'C: See YEARFIX comment above
		var year = parseInt(event_key.substring(0,4));
		
		//
		// Remove 'assigned_scorer' from all matching scoringdata elements
		//
		scoreDataCol.bulkWrite([{updateMany:{filter:{ "event_key": eventId }, update:{ $unset: { "assigned_scorer" : "" } }}}], function(e, docs){
			return res.send({status: 200, alert: "Cleared existing match scouting assignments successfully."});
		});
	});
		
/* End regular code ----------------------------------------------------------- */
			}
		});
	});
});

//////////// Match allocating by team assignment

router.post("/generatematchallocations", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	//override if dev
	if( req.app.isDev ){
		generateMatchAllocations(req, res);
	}
	else{
	
		var passCheckSuccess;
		
		if( !req.body.password || req.body.password == ""){
			return res.send({status: 401, alert: "No password entered."});
		}
		if( !require('../checkauthentication')(req, res, 'admin') )
			return res.log('admin not logged in on generateteamallocations');
		
		var teammembers = req.db.get('teammembers');
		
		teammembers.find( { name: req.user.name }, {}, function( e, user ){
			if(e)
				return console.error(e);
			if(!user[0]){
				res.send({status: 500, alert:"Passport error: no user found in db?"});
				return console.error("no user found? generateteamallocations");
			}
			
			bcrypt.compare( req.body.password, user[0].password, function(e, out){
				if(e)
					return console.error(e);
				if(out == true)
					passCheckSuccess = true;
				else
					return res.send({status: 401, alert: "Password incorrect."});
				
				if(passCheckSuccess){
					generateMatchAllocations(req, res);
				}
			});
		});
	}
});

router.get("/swapmembers", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "scoutingpairs.swapmembers[get]: ";
	
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");

	var db = req.db;
	var currentCol = db.get("current");
	var scoreDataCol = db.get("scoringdata");
	var matchCol = db.get("matches");
	var teammembers = req.db.get("teammembers");

	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			res.render('/adminindex', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// for later querying by event_key
		var event_key = eventId;
	
		// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
		matchCol.find({ event_key: eventId, "alliances.red.score": -1 },{sort: {"time": 1}}, function(e, docs){

			// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
			var earliestTimestamp = 9999999999;
			if (docs && docs[0])
			{
				var earliestMatch = docs[0];
				earliestTimestamp = earliestMatch.time;
			}
				
			// Get the distinct list of scorers from the unresolved matches
			scoreDataCol.distinct("assigned_scorer", {"event_key": eventId, "time": { $gte: earliestTimestamp }}, function (e, docs) {
				var scorers = docs;
				res.log(thisFuncName + 'distinct assigned_scorers: ' + JSON.stringify(scorers));
		
				// Get list of all users
				teammembers.find( {}, {sort:{ "name": 1 }}, function(e, docs){
					var users = docs;

					// Go to a Pug to show two lists & a button to do the swap - form with button
					res.render("./admin/swapmembers", {
						title: "Swap Match Scouts",
						scorers: scorers,
						users: users
					});
				});
			});
		});
	});
});

router.post("/swapmembers", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "scoutingpairs.swapmembers[post]: ";
	
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");
	
	// Extract 'from' & 'to' from req
	var swapout = req.body.swapout;
	var swapin = req.body.swapin;
	res.log(thisFuncName + 'swap out ' + swapin + ', swap in ' + swapout);

	var db = req.db;
	var currentCol = db.get("current");
	var scoreDataCol = db.get("scoringdata");
	var matchCol = db.get("matches");
	
	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			res.render('/adminindex', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// for later querying by event_key
		var event_key = eventId;

		// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
		matchCol.find({ event_key: eventId, "alliances.red.score": -1 },{sort: {"time": 1}}, function(e, docs){

			// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
			var earliestTimestamp = 9999999999;
			if (docs && docs[0])
			{
				var earliestMatch = docs[0];
				earliestTimestamp = earliestMatch.time;
			}
				
			// Do the updateMany - change instances of swapout to swapin
			scoreDataCol.bulkWrite([{updateMany:{filter: { assigned_scorer: swapout, event_key: eventId, "time": { $gte: earliestTimestamp } }, 
				update:{ $set: { assigned_scorer: swapin } }}}], function(e, docs){

				res.redirect("/dashboard/matches");
			});
		});
	});
});

function generateMatchAllocations(req, res){
	/* Begin regular code ----------------------------------------------------------- */
	
	// HARDCODED
	var activeTeamKey = 'frc102';
		
	var thisFuncName = "scoutingpairs.generateMATCHallocations[post]: ";

	// used when writing data to DB, for later querying by year
	// 2019-01-23, M.O'C: See YEARFIX comment above
	//var year = (new Date()).getFullYear();
							
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");

	var db = req.db;
	var currentCol = db.get("current");
	var scoutPairCol = db.get("scoutingpairs");
	var memberCol = db.get("teammembers");
	var scoutDataCol = db.get("scoutingdata");
	var scoreDataCol = db.get("scoringdata");
	var matchDataCol = db.get("matches");

	if(db._state == 'closed'){ //If database does not exist, send error
		return res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}

	// nodeclient
	var Client = require('node-rest-client').Client;
	var client = new Client();
	var args = {
		headers: { "accept": "application/json", "X-TBA-Auth-Key": "iSpbq2JH2g27Jx2CI5yujDsoKYeC8pGuMw94YeK3gXFU6lili7S2ByYZYZOYI3ew" }
	}
		
	//
	// Get the 'current' event from DB
	//
	currentCol.find({}, {}, function(e, docs) {
		var noEventFound = 'No event defined';
		var eventId = noEventFound;
		if (docs)
			if (docs.length > 0)
				eventId = docs[0].event;
		if (eventId === noEventFound) {
			return res.render('./admin/admin', { 
				title: 'Admin pages',
				current: eventId
			});
		}
		// used when writing data to DB, for later querying by event_key
		var event_key = eventId;

		// 2019-01-23, M.O'C: See YEARFIX comment above
		var year = parseInt(event_key.substring(0,4));

		// { year, event_key, match_key, match_number, alliance, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }

		// Need: Map, teamID->primary/secondar/tertiary
		// Read all matches
		// For each match:
		// Go through the teams, build data elements without assignees
		// Try to allocate primaries (track assigned members in a map - can't assign someone twice!)
		// Repeat again if blanks left over with secondaries
		// Repeat again if blanks left over with tertiaries
		// Add batch to collecting array for eventual DB mass insert

		// Need map of team IDs to scouts (scoutingdata)
		scoutDataCol.find({"event_key": event_key}, function(e, docs) {
			if(e){ //if error, log to console
				res.log(thisFuncName + e);
			}
			var scoutDataArray = docs;
			
			// Build teamID->primary/secondar/tertiary lookup
			var scoutDataByTeam = {};
			var scoutDataLen = scoutDataArray.length;
			for (var i = 0; i < scoutDataLen; i++)
				scoutDataByTeam[scoutDataArray[i].team_key] = scoutDataArray[i];
			
			// Read all matches
			var url = "https://www.thebluealliance.com/api/v3/event/" + eventId + "/matches/simple";
			res.log(thisFuncName + "url=" + url);

			//// WARNING WARNING DANGER WILL ROBINSON - Manually editing for local DB access!
	//			matchDataCol.find({"event_key": event_key}, function(e, docs) {
	//				var matchArray = docs;
	//				var matchLen = matchArray.length;

			client.get(url, args, function (data, response) {
				var matchArray = JSON.parse(data);
				var matchLen = matchArray.length;
				if (matchLen == null)
				{
					res.log(thisFuncName + "Whoops, there was an error!");
					res.log(thisFuncName + "matchArray=" + matchArray);
					
					res.render('./admin/admin', { 
						title: 'Admin pages',
						current: eventId
					});
					return;
				}
				res.log(thisFuncName + 'Found ' + matchLen + ' matches for event ' + eventId);

				// Build up the scoringdata array
				var scoringDataArray = [];
				// Loop through each match
				for (var matchIdx = 0; matchIdx < matchLen; matchIdx++) {
					var thisMatch = matchArray[matchIdx];
					//res.log(thisFuncName + "*** thisMatch=" + thisMatch.key);
					
					// Build unassigned match-team data elements
					var thisMatchDataArray = [];
					
					// { year, event_key, match_key, match_number, alliance, team_key, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }
					var allianceArray = [ "red", "blue" ];
					for (var allianceIdx = 0; allianceIdx < allianceArray.length; allianceIdx++) {
						// teams are indexed 0, 1, 2
						for (var teamIdx = 0; teamIdx < 3; teamIdx++)
						{
							var thisScoreData = {};
							
							thisScoreData["year"] = year;
							thisScoreData["event_key"] = event_key;
							thisScoreData["match_key"] = thisMatch.key;
							thisScoreData["match_number"] = thisMatch.match_number;
							// time is the best 'chronological order' sort field
							thisScoreData["time"] = thisMatch.time;
							
							thisScoreData["alliance"] = allianceArray[allianceIdx];
							thisScoreData["team_key"] = thisMatch.alliances[allianceArray[allianceIdx]].team_keys[teamIdx];
							thisScoreData["match_team_key"] = thisMatch.key + "_" + thisScoreData["team_key"];

							//res.log(thisFuncName + "thisScoreData=" + JSON.stringify(thisScoreData));
							
							thisMatchDataArray.push(thisScoreData);
						}
					}
					var thisMatchLen = thisMatchDataArray.length;
					//res.log(thisFuncName + "thisMatchDataArray=" + JSON.stringify(thisMatchDataArray));
					
					// Keep track of who we've assigned - can't assign someone twice!
					var assignedMembers = {};
					// Go through assigning primaries first, then secondaries, then tertiaries
					var roleArray = [ "primary", "secondary", "tertiary" ];
					for (var roleIdx = 0; roleIdx < roleArray.length; roleIdx++) {
						// Which role (primary? secondary? tertiary?) are we checking
						var thisRole = roleArray[roleIdx];
						// Cycle through the scoring data, looking for blank assignees
						for (var thisMatchIdx = 0; thisMatchIdx < thisMatchLen; thisMatchIdx++) {
							var thisScoreData = thisMatchDataArray[thisMatchIdx];
							//res.log(thisFuncName + "thisScoreData=" + thisScoreData);
							// Not yet assigned?
							if (!(thisScoreData.assigned_scorer)) {
								// Which team is this?
								var thisTeamKey = thisScoreData.team_key;
								//res.log(thisFuncName + 'thisTeamKey=' + thisTeamKey);
								
								// 2018-03-15, M.O'C: Skip assigning if this teams is the "active" team (currently hardcoding to 'frc102')
								if (activeTeamKey != thisTeamKey)
								{					
									// Who is assigned to this team?
									var thisScoutData = scoutDataByTeam[thisTeamKey];
									var thisPossibleAssignee = thisScoutData[thisRole];
									// Only check if this role is defined for this team
									if (thisPossibleAssignee) {
										// Only proceed if this person is not yet assigned elsewhere
										if (!assignedMembers[thisPossibleAssignee]) {
											// Good to assign!
											thisMatchDataArray[thisMatchIdx].assigned_scorer = thisPossibleAssignee;
											// Mark them as assigned to a team
											assignedMembers[thisPossibleAssignee] = thisPossibleAssignee;
										}
									}
								}
							}
						}
					}
					
					res.log(thisFuncName + "*** thisMatch=" + thisMatch.key);
					for (var thisMatchDataIdx = 0; thisMatchDataIdx < thisMatchLen; thisMatchDataIdx++) {
						res.log(thisFuncName + "team,assigned=" + thisMatchDataArray[thisMatchDataIdx].team_key + " ~> " + thisMatchDataArray[thisMatchDataIdx].assigned_scorer);
						// add to the overall array of match assignments
						scoringDataArray.push(thisMatchDataArray[thisMatchDataIdx]);
					}
				}

				// Delete ALL the old elements first for the 'current' event
				scoreDataCol.remove({"event_key": event_key}, function(e, docs) {
					// Insert the new data - w00t!
					scoreDataCol.insert(scoringDataArray, function(e, docs) {
						//res.redirect("./");	
						return res.send({status: 200, alert: "Generated team allocations successfully."});
					});
				});
			});
		});
	});
	/* End regular code ----------------------------------------------------------- */
}

//SEPARATE FUNCTION FOR GENERATETEAMALLOCATIONS
function generateTeamAllocations(req, res){
	/* Begin regular code ----------------------------------------------------------- */	
	
	// HARDCODED
	var activeTeamKey = 'frc102';			
		
	var thisFuncName = "scoutingpairs.generateTEAMallocations[post]: ";

	// used when writing data to DB, for later querying by year
	// 2019-01-23, M.O'C: YEARFIX Why did I think using THIS year was a good idea? What about doing things with *last* year's data? :-/
	// Instead, let's use the 1st four characters of the 'currentevent' (always a year)
	//var year = (new Date()).getFullYear();
							
	// Log message so we can see on the server side when we enter this
	res.log(thisFuncName + "ENTER");
	
	var db = req.db;
	var currentCol = db.get("current");
	var currentTeamsCol = db.get("currentteams");
	var scoutPairCol = db.get("scoutingpairs");
	var memberCol = db.get("teammembers");
	var scoutDataCol = db.get("scoutingdata");
	var scoreDataCol = db.get("scoringdata");

	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}

	// nodeclient
	var client = req.client;
	var args = req.tbaRequestArgs;
	
	var event_key = req.event.key;
	var year = req.event.year;
	
	//
	// Get the current set of already-assigned pairs; make a map of {"id": {"prim", "seco", "tert"}}
	//
	scoutPairCol.find({}, {}, function (e, docs) {
		if(e){ //if error, log to console
			res.log(thisFuncName + e);
		}
		var scoutingpairs = docs;

		// Iterate through scoutingpairs; create {1st: 2nd: 3rd:} and add to 'dict' keying off 1st <1, or 1/2 2/1, or 1/2/3 2/3/1 3/1/2>
		var primaryAndBackupMap = {};
		var scoutingAssignedArray = [];
		
		var pairsLen = scoutingpairs.length;
		for (var i = 0; i < pairsLen; i++) {
			var thisPair = scoutingpairs[i];
			if (thisPair.member3) {
				var set1 = {}; set1.primary = thisPair.member1; set1.secondary = thisPair.member2; set1.tertiary = thisPair.member3; primaryAndBackupMap[set1.primary] = set1;
				scoutingAssignedArray.push(set1.primary);
				var set2 = {}; set2.primary = thisPair.member2; set2.secondary = thisPair.member3; set2.tertiary = thisPair.member1; primaryAndBackupMap[set2.primary] = set2;
				scoutingAssignedArray.push(set2.primary);
				var set3 = {}; set3.primary = thisPair.member3; set3.secondary = thisPair.member1; set3.tertiary = thisPair.member2; primaryAndBackupMap[set3.primary] = set3;
				scoutingAssignedArray.push(set3.primary);
			} else if (thisPair.member2) {
				var set1 = {}; set1.primary = thisPair.member1; set1.secondary = thisPair.member2; primaryAndBackupMap[set1.primary] = set1;
				scoutingAssignedArray.push(set1.primary);
				var set2 = {}; set2.primary = thisPair.member2; set2.secondary = thisPair.member1; primaryAndBackupMap[set2.primary] = set2;
				scoutingAssignedArray.push(set2.primary);
			} else {
				var set1 = {}; set1.primary = thisPair.member1; primaryAndBackupMap[set1.primary] = set1;
				scoutingAssignedArray.push(set1.primary);
			}
		}
		//res.log(thisFuncName + "primaryAndBackupMap=" + JSON.stringify(primaryAndBackupMap));

		//
		// Read all present members, ordered by 'seniority' ~ have an array ordered by seniority
		//
		memberCol.find({ "name": {$in: scoutingAssignedArray }}, { sort: {"seniority": 1, "subteam": 1, "name": 1} }, function(e, docs) {
			res.log(thisFuncName + "inside memberCol.find()");
			if(e){ //if error, log to console
				res.log(thisFuncName + e);
			}
			var teammembers = docs;
			var teammembersLen = teammembers.length;
			
			currentTeamsCol.find({},{}, function(e, teamArray){
				
				//
				// Cycle through teams, adding 1st 2nd 3rd to each based on array of 1st2nd3rds
				//
				var teamArrayLen = teamArray.length;
				var teamassignments = [];
				var teamassignmentsByTeam = {};
				var assigneePointer = 0;
				for (var i = 0; i < teamArrayLen; i++) {
					var thisTbaTeam = teamArray[i];
					var thisTeammemberName = teammembers[assigneePointer].name;
					var thisPrimaryAndBackup = primaryAndBackupMap[thisTeammemberName];
					/*
					res.log(thisFuncName + "i=" + i + "; assigneePointer=" + assigneePointer);
					res.log(thisFuncName + "thisTbaTeam=" + JSON.stringify(thisTbaTeam));
					res.log(thisFuncName + "thisTeammemberName=" + thisTeammemberName);
					res.log(thisFuncName + "thisPrimaryAndBackup=" + JSON.stringify(thisPrimaryAndBackup));
					*/
					
					// { year, event_key, team_key, primary, secondary, tertiary, actual, scouting_data: {} }
					var thisAssignment = {};
					// general info
					thisAssignment["year"] = year;
					thisAssignment["event_key"] = event_key;
					// unique per team
					thisAssignment["team_key"] = thisTbaTeam.key;
					
					// 2018-03-15, M.O'C: Skip assigning if this teams is the "active" team (currently hardcoding to 'frc102')
					if (activeTeamKey != thisTbaTeam.key) {						
						thisAssignment["primary"] = thisPrimaryAndBackup.primary;
						if (thisPrimaryAndBackup.secondary)
							thisAssignment["secondary"] = thisPrimaryAndBackup.secondary;
						if (thisPrimaryAndBackup.tertiary)
							thisAssignment["tertiary"] = thisPrimaryAndBackup.tertiary;
						
						assigneePointer += 1;
						if (assigneePointer >= teammembersLen)
							assigneePointer = 0;
					} else {
						res.log(thisFuncName + "Skipping team " + thisTbaTeam.key);
					}
						
					
					// Array for mass insert
					teamassignments.push(thisAssignment);
					// Map of assignments by team so we can lookup by team later during match assigning
					teamassignmentsByTeam[thisTbaTeam.key] = thisAssignment;
				}
				res.log(thisFuncName + "****** New/updated teamassignments:");
				for (var i = 0; i < teamArrayLen; i++)
					res.log(thisFuncName + "team,primary,secondary,tertiary=" + teamassignments[i].team_key + " ~> " + teamassignments[i].primary + "," + teamassignments[i].secondary + ","  + teamassignments[i].tertiary);
				
				// Delete ALL the old elements first for the 'current' event
				scoutDataCol.remove({"event_key": event_key}, function(e, docs) {
					// Insert the new data
					scoutDataCol.insert(teamassignments, function(e, docs) {
						//res.redirect("./");	
						return res.send({status: 200, alert: "Generated team allocations successfully."});
					});
				});
			});
		});
	});

/* End regular code ----------------------------------------------------------- */
}

module.exports = router;
