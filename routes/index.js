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
	
	//if there is data in the request, proceed
	if(req.body && req.body != {}){
		console.log("body: "+typeof(req.body));
		console.log("message_type: "+typeof(req.body.message_type));
		console.log("message_data: "+typeof(req.body.message_data));
		
		switch(req.body.message_type){
			case "match_score":
				updateMatch(req, res);
				res.sendStatus(200);
				break;
			case "ping":
				res.sendStatus(200);
				break;
		}
	}
});

function updateRankings(req, res){
	
	// REST client for accessing TBA
	var client = req.client;
	var args = req.tbaRequestArgs;
	
	var event_key = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Delete the current rankings
	rankCol.remove({}, function(e, docs) {
		// Reload the rankings from TBA
		var rankingUrl = "https://www.thebluealliance.com/api/v3/event/" + event_key + "/rankings";
		res.log(thisFuncName + "rankingUrl=" + rankingUrl);
	
		client.get(rankingUrl, args, function (data, response) {
			var rankinfo = JSON.parse(data);
			var rankArr = [];
			if (rankinfo)
				rankArr = rankinfo.rankings;
			
			var rankMap = {};
			for (var rankIdx = 0; rankIdx < rankArr.length; rankIdx++) {
				//res.log(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
				rankMap[rankArr[rankIdx].team_key] = rankArr[rankIdx];
			}
			
			// Insert into DB
			rankCol.insert(rankArr, function(e, docs) {
				if(e) console.error(e);
			});
		});
	});
}

function updateMatch(req, res){
	
	//2019-03-30 JL: Copying from current/updatematch for webhook handling
	
	var thisFuncName = "index.webhook[post]: updateMatch: ";
	
	var db = req.db;
	var matchCol = db.get("matches");
	var rankCol = db.get("currentrankings");
	// 2019-03-21, M.O'C: Adding in aggregation of scoring data to generate & save min/max ranges for all scoring attributes
	var scoreCol = db.get("scoringlayout");
	var aggCol = req.db.get('scoringdata');
	// And INTRODUCING... The 'currentaggranges' collection
	var currentAggCol = db.get("currentaggranges");
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	
	var data = req.body.message_data;
	res.log("data:");
	res.log(JSON.stringify(data, null, 4));
	
	//if data is an object, proceed
	if(typeof(data) == "object"){
		
		var match_key = data.match.key;
		
		res.log(`Match update pushed for ${match_key}`, true);
		
		// stick it in an array so the insert will work later
		var match = data;
		var array = [match];
		
		// Delete the matching match record
		matchCol.remove({"key": match_key}, function(e, docs) {
		
			// Now, insert the new object
			matchCol.insert(array, function(e, docs) {
				if(e)console.log(e);
				
				// Then read all the matches back in order
				
				matchCol.find({"event_key": event_key},{sort: {"time": 1}}, function(e, docs){
					var matches = docs;
					
					// 2019-03-21, M.O'C: Adding in recalculation of aggregation data
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
						//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));

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

									//res.log(thisFuncName + 'thisMinMax=' + JSON.stringify(thisMinMax));

									aggMinMaxArray.push(thisMinMax);
								}
							}
							//res.log(thisFuncName + 'aggMinMaxArray=' + JSON.stringify(aggMinMaxArray));

							// Delete the current agg ranges
							currentAggCol.remove({}, function(e, docs) {
								// Reinsert the updated values
								currentAggCol.insert(aggMinMaxArray, function(e, docs) {
									// And we're done!
									//2019-03-30 JL: No page-rendering necessary, for a bot sent us this req
									console.log("finished");
								});
							});
						});
					});
				});
			});
		});
	}
}

/**
 * Main homepage.
 * @url /
 * @view /index
 */

router.get('/', async function(req, res) {
	
	//Prepare an alert. (Used w/ url /?alert=(alert))
	if(req.query)
		var alert = req.query.alert || null;
	
	return res.render('./index', {
		title: 'Home',
		alert: alert
	});
		
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