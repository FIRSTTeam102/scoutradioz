var express = require('express');
var router = express.Router();

router.get("/matches", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;

	var thisFuncName = "current.matches[get]: ";
	res.log(thisFuncName + 'ENTER')
	
    // Set our internal DB variable
    var db = req.db;
	var eventId = req.event.key;
		
	// Read matches from DB for specified event
	var matchCol = db.get("matches");
	matchCol.find({"event_key": eventId},{sort: {"time": 1}}, function(e, docs){
		
		if(e){ //if error, log to console
			res.log(e);
		}
		matches = docs;
		
		res.render("./admin/currentmatches", {
			title: "Matches",
			"matches": matches
		});
	});
});

router.get("/getcurrentteams", async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	//set up db collections
	var db = req.db;
	var passwordsCol = db.get("passwords");
	var currentTeamsCol = db.get("currentteams");
	
	//get TBA key from db
	passwordsCol.find({ name:"thebluealliance-args" }, function(e, args){
		if(e || !args[0]){
			return res.status(500).send("couldn't find TBA args in db");
		}
		args = args[0];
		
		//set up tba call
		var Client = require('node-rest-client').Client;
		var client = new Client();
		var eventId = req.event.key;
		var teamsUrl = `https://www.thebluealliance.com/api/v3/event/${eventId}/teams`;
		
		//get teams from tba
		client.get(teamsUrl, args, function (data, response) {
			
			var currentTeams = JSON.parse(data);
			
			if(!currentTeams){
				return res.status(500).send("didn't get teams list");
			}
			
			//delete contents of currentteams
			currentTeamsCol.remove({},function(){
				
				//insert teams into currentteams
				currentTeamsCol.insert(currentTeams, function(){
					res.redirect('/admin?alert=Updated current teams successfully.');
				});
			})
		});
	});
})

router.post("/resetmatches", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "current.resetmatches[post]: ";
	res.log(thisFuncName + 'ENTER');
	
    // Set our internal DB variable
    var db = req.db;
	var matchCol = db.get("matches");
	
	var eventId = req.event.key;
	
	// update all matches - set 'actualtime' to null/"", and team scores to -1
	matchCol.bulkWrite([{updateMany:{filter:{"event_key": eventId}, update:{ $set: { "actual_time" : "", "winning_alliance" : "", "alliances.blue.score": -1, "alliances.red.score": -1 } }}}], function(e, docs){
		// reread the data & render
		matchCol.find({"event_key": eventId},{sort: {"time": 1}}, function(e, docs){
		
			if(e){ //if error, log to console
				res.log(e);
			}
			matches = docs;
			
			res.render("./admin/currentmatches", {
				title: "Matches",
				"matches": matches
			});
		});
	});		
});

router.post("/updatematch", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "current.updatematch[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var matchId = req.body.matchId;

    // Set our internal DB variable
    var db = req.db;
	var matchCol = db.get("matches");
	var rankCol = db.get("currentrankings");

	// 2019-03-21, M.O'C: Adding in aggregation of scoring data to generate & save min/max ranges for all scoring attributes
	var scoreCol = db.get("scoringlayout");
	var event_year = req.event.year;
	var event_key = req.event.key;
	var aggCol = req.db.get('scoringdata');
	// And INTRODUCING... The 'currentaggranges' collection
	var currentAggCol = db.get("currentaggranges");

	// REST client for accessing TBA
	var client = req.client;
	var args = req.tbaRequestArgs;
	
	var eventId = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Delete the current rankings
	rankCol.remove({}, function(e, docs) {
		// Reload the rankings from TBA
		var rankingUrl = "https://www.thebluealliance.com/api/v3/event/" + eventId + "/rankings";
		res.log(thisFuncName + "rankingUrl=" + rankingUrl);
	
		client.get(rankingUrl, args, function (data, response) {
			var rankinfo = JSON.parse(data);
			var rankArr = [];
			if (rankinfo)
				rankArr = rankinfo.rankings;
			//res.log(thisFuncName + 'rankArr=' + JSON.stringify(rankArr));

			var rankMap = {};
			for (var rankIdx = 0; rankIdx < rankArr.length; rankIdx++) {
				//res.log(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
				rankMap[rankArr[rankIdx].team_key] = rankArr[rankIdx];
			}
	
			// Insert into DB
			rankCol.insert(rankArr, function(e, docs) {
			
				// Delete the matching match record
				matchCol.remove({"key": matchId}, function(e, docs) {
					// Reload the match data from TBA
					var url = "https://www.thebluealliance.com/api/v3/match/" + matchId;
					res.log(thisFuncName + "url=" + url);
				
					client.get(url, args, function (data, response) {
						var match = JSON.parse(data);
						// stick it in an array so the insert will work later
						var array = [];
						array.push(match);
						
						// Now, insert the new object
						matchCol.insert(array, function(e, docs) {
							// Then read all the matches back in order
							matchCol.find({"event_key": eventId},{sort: {"time": 1}}, function(e, docs){
								var matches = docs;
								
								//
								// 2019-03-21, M.O'C: Adding in recalculation of aggregation data
								//
								res.log(thisFuncName + 'About to start in on updating min/maxes of agg data');
								scoreCol.find({ "year": event_year }, {sort: {"order": 1}}, function(e, docs){
									var scorelayout = docs;
									
									var aggQuery = [];
									aggQuery.push({ $match : { "event_key": event_key } });
									var groupClause = {};
									// group teams for 1 row per team
									groupClause["_id"] = "$team_key";
						
									for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
										var thisLayout = scorelayout[scoreIdx];
										thisLayout.key = thisLayout.id;
										scorelayout[scoreIdx] = thisLayout;
										if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
										{
											groupClause[thisLayout.id + "MIN"] = {$min: "$data." + thisLayout.id};
											groupClause[thisLayout.id + "AVG"] = {$avg: "$data." + thisLayout.id};
											groupClause[thisLayout.id + "VAR"] = {$stdDevPop: "$data." + thisLayout.id};
											groupClause[thisLayout.id + "MAX"] = {$max: "$data." + thisLayout.id};
										}
									}
									aggQuery.push({ $group: groupClause });
									aggQuery.push({ $sort: { _id: 1 } });
									res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

									// Run the aggregation!
									aggCol.aggregate(aggQuery, function(e, docs){
										var aggArray = [];
										if (docs)
											aggArray = docs;
											
										//res.log(rankMap);

										var aggMinMaxArray = [];

										// Cycle through & build a map of min/max values per scoring type per aggregation
										for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
											var thisLayout = scorelayout[scoreIdx];
											if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
											{
												var thisMinMax = {};

												// initialize ranges
												var MINmin = 999999; var MINmax = 0; var AVGmin = 999999; var AVGmax = 0; var VARmin = 999999; var VARmax = 0; var MAXmin = 999999; var MAXmax = 0;
												// cycle through all the per-team aggregated data
												for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
													var thisAgg = aggArray[aggIdx];
													var roundedMinVal = (Math.round(thisAgg[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
													var roundedAvgVal = (Math.round(thisAgg[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
													var roundedVarVal = (Math.round(thisAgg[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
													var roundedMaxVal = (Math.round(thisAgg[thisLayout.id + "MAX"] * 10)/10).toFixed(1);

													if (roundedMinVal < MINmin) MINmin = roundedMinVal; if (roundedMinVal > MINmax) MINmax = roundedMinVal; 
													if (roundedAvgVal < AVGmin) AVGmin = roundedAvgVal; if (roundedAvgVal > AVGmax) AVGmax = roundedAvgVal; 
													if (roundedVarVal < VARmin) VARmin = roundedVarVal; if (roundedVarVal > VARmax) VARmax = roundedVarVal; 
													if (roundedMaxVal < MAXmin) MAXmin = roundedMaxVal; if (roundedMaxVal > MAXmax) MAXmax = roundedMaxVal; 
												}

												thisMinMax['key'] = thisLayout.key;
												thisMinMax['MINmin'] = MINmin; thisMinMax['MINmax'] = MINmax;
												thisMinMax['AVGmin'] = AVGmin; thisMinMax['AVGmax'] = AVGmax;
												thisMinMax['VARmin'] = VARmin; thisMinMax['VARmax'] = VARmax;
												thisMinMax['MAXmin'] = MAXmin; thisMinMax['MAXmax'] = MAXmax;

												res.log(thisFuncName + 'thisMinMax=' + JSON.stringify(thisMinMax));

												aggMinMaxArray.push(thisMinMax);
											}
										}
										console.log(thisFuncName + 'aggMinMaxArray=' + JSON.stringify(aggMinMaxArray));

										// Delete the current agg ranges
										currentAggCol.remove({}, function(e, docs) {
											// Reinsert the updated values
											currentAggCol.insert(aggMinMaxArray, function(e, docs) {
												// And we're done!
												res.render("./admin/currentmatches", {
													title: "Matches",
													"matches": matches
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
	});
});

router.post("/updatematches", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "current.updatematches[post]: ";
	res.log(thisFuncName + 'ENTER')
	
    // Set our internal DB variable
    var db = req.db;
	var matchCol = db.get("matches");
	var rankCol = db.get("currentrankings");
	
	// nodeclient
	var Client = require('node-rest-client').Client;
	var client = new Client();
	var args = {
		headers: { "accept": "application/json", "X-TBA-Auth-Key": "iSpbq2JH2g27Jx2CI5yujDsoKYeC8pGuMw94YeK3gXFU6lili7S2ByYZYZOYI3ew" }
	}
	
	var matchId = req.body.matchId;
	var eventId = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Delete the current rankings
	rankCol.remove({}, function(e, docs) {
		// Reload the rankings from TBA
		var rankingUrl = "https://www.thebluealliance.com/api/v3/event/" + eventId + "/rankings";
		res.log(thisFuncName + "rankingUrl=" + rankingUrl);
	
		client.get(rankingUrl, args, function (data, response) {
			var rankinfo = JSON.parse(data);
			var rankArr = [];
			if (rankinfo)
				rankArr = rankinfo.rankings;
			//res.log(thisFuncName + 'rankArr=' + JSON.stringify(rankArr));

			// Insert into DB
			rankCol.insert(rankArr, function(e, docs) {
				// Get matches data from TBA
				var url = "https://www.thebluealliance.com/api/v3/event/" + eventId + "/matches";
				res.log(thisFuncName + "url=" + url);
				client.get(url, args, function (data, response) {
					var array = JSON.parse(data);
					var arrayLength = array.length;
					if (arrayLength == null)
					{
						res.log(thisFuncName + "Whoops, there was an error!")
						res.log(thisFuncName + "data=" + data);
						
						res.render('./admin/admin', { 
							title: 'Admin pages',
							current: eventId
						});
					}
					else
					{
						res.log(thisFuncName + 'Found ' + arrayLength + ' data for event ' + eventId);
						
						// First delete existing match data for the given event
						matchCol.remove({"event_key": eventId}, function(e, docs) {
							// Now, insert the new data
							matchCol.insert(array, function(e, docs) {
								// Then read it back in order
								matchCol.find({"event_key": eventId},{sort: {"time": 1}}, function(e, docs){
									var matches = docs;
									
									res.render("./admin/currentmatches", {
										"matches": matches
									});
								});
							});
						});
					}
				});
			});
		});
	});
});

module.exports = router;
