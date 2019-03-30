var express = require("express");
var router = express.Router();

router.get("/", function(req, res){
	var thisFuncName = "allianceselection{root}[get]: ";
	res.log(thisFuncName + 'ENTER');
	
	var db = req.db;
	var aggCol = req.db.get('scoringdata');
	var scoreCol = db.get("scoringlayout");
	var rankCol = db.get('currentrankings');
	// 2019-03-21, M.O'C: Utilize the currentaggranges
	var currentAggCol = db.get("currentaggranges");
	
	// for later querying by event_key
	var event_key = req.event.key;
	var event_year = req.event.year;
	res.log(thisFuncName + 'event_key=' + event_key);
	
	// get the current rankings
	rankCol.find({}, {}, function (e, docs) {
		var rankings = [];
		if (docs)
			rankings = docs;
		var rankMap = {};
		for (var rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
			//res.log(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
			rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
		}
		//res.log(thisFuncName + 'rankMap=' + JSON.stringify(rankMap));

		// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
		// db.scoringdata.aggregate( [ 
		// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
		// { $group : { _id: "$event_key",
		// "autoScaleAVG": {$avg: "$data.autoScale"},
		// "teleScaleAVG": {$avg: "$data.teleScale"},
		//  } }
		// ] );						
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
					groupClause[thisLayout.id] = {$avg: "$data." + thisLayout.id};
			}
			aggQuery.push({ $group: groupClause });
			aggQuery.push({ $sort: { _id: 1 } });
			//res.log(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery));
			
			aggCol.aggregate(aggQuery, function(e, docs){
				var aggArray = [];
				if (docs)
					aggArray = docs;
					
				res.log(rankMap);
				
				// Rewrite data into display-friendly values
				for (var aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
					var thisAgg = aggArray[aggIdx];
					for (var scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
						var thisLayout = scorelayout[scoreIdx];
						if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
							var roundedVal = (Math.round(thisAgg[thisLayout.id] * 10)/10).toFixed(1);
							thisAgg[thisLayout.id] = roundedVal;
						}
					}
					if(rankMap[thisAgg._id]){
						thisAgg['rank'] = rankMap[thisAgg._id].rank;
						thisAgg['value'] = rankMap[thisAgg._id].value;
						aggArray[aggIdx] = thisAgg;
					}
				}
				//res.log(thisFuncName + 'aggArray=' + JSON.stringify(aggArray));

				// read in the current agg ranges
				currentAggCol.find({}, {}, function (e, docs) {
					var currentAggRanges = [];
					if (docs)
						currentAggRanges = docs;

					res.render("./allianceselection/allianceselection-index", {
						title: "Alliance Selection",
						aggdata: aggArray,
						currentAggRanges: currentAggRanges,
						layout: scorelayout
					});
				});
			});
		});
	});
});

router.post("/updateteamvalue", function(req, res){
	var thisFuncName = "allianceselection.updateteamvalue[post]: ";
	res.log(thisFuncName + 'ENTER')

	var db = req.db;
	
	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
	var rankCol = db.get("currentrankings");
	
	var teamKey = req.body.key;
	var value = req.body.value;

	rankCol.update({"team_key": teamKey}, {$set: {"value": value}}, function(e, docs){
		res.redirect("./");
	});
});

module.exports = router;