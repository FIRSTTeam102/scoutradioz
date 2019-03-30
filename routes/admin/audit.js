var express = require('express');
var router = express.Router();

/**
 * Scoring audit page.
 * @url /admin/scoringaudit
 * @view /admin/index, /admin/scoringaudit
 */
router.get("/", function(req, res) {
	if(!require('../checkauthentication')(req, res, 'admin')){
		return null;
	}
	
	var thisFuncName = "audit.root[GET]:";
	res.log(`${thisFuncName} enter`);
		
	var scoreDataCol = req.db.get("scoringdata");
	var matchCol = req.db.get("matches");
	
	var eventId = req.event.key;

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	matchCol.find({ event_key: eventId, "alliances.red.score": -1 },{sort: {"time": 1}}, function(e, matches){
		
		// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
		var earliestTimestamp = 9999999999;
		if (matches && matches[0])
		{
			var earliestMatch = matches[0];
			earliestTimestamp = earliestMatch.time;
		}
		
		res.log("Scoring audit: earliestTimestamp=" + earliestTimestamp);
		
		// Get all the RESOLVED matches
		scoreDataCol.find({"event_key": eventId, "time": { $lt: earliestTimestamp }}, { sort: {"assigned_scorer": 1, "time": 1, "alliance": 1, "team_key": 1} }, function (e, scoreData) {
			if(!scoreData)
				return res.redirect("/?alert=mongo error at dashboard/matches");
			
			// Build per-team-member array
			var memberArr = [];
			var lastMember = 'NOLASTMEMBER';
			var thisMemberArr = [];
			
			if (scoreData && scoreData.length > 0) {
				for (var scoreIdx = 0; scoreIdx < scoreData.length; scoreIdx++) {
					var thisMember = scoreData[scoreIdx].assigned_scorer;
					if (thisMember != lastMember) {
						var thisRow = {};
						thisRow['member'] = lastMember;
						thisRow['record'] = thisMemberArr;
						if ('NOLASTMEMBER' != lastMember)
							memberArr.push(thisRow);
						
						lastMember = thisMember;
						thisMemberArr = [];
					}
					
					//create audit-element to push
					var auditElement = {};
					var auditElementChar;
					//set auditElement.match_team_key
					if(scoreData[scoreIdx]){
						auditElement.match_team_key = scoreData[scoreIdx].match_team_key;
					}
					
					if (scoreData[scoreIdx].data){
						
						if (scoreData[scoreIdx].assigned_scorer == scoreData[scoreIdx].actual_scorer)
							auditElementChar = "Y";
						else
							// 2019-03-16 JL: App crashed due to actual_scorer being undefined
							if (scoreData[scoreIdx].actual_scorer == undefined){
								res.log(`${thisFuncName} actual_scorer undefined`);
								auditElementChar = "N";
							}
							// 2018-03-22, M.O'C: Adding parent option
							else if (scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('mr') || 
								scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('mrs') || 
								scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('ms')){
									//covered by parent (and insert actual_scorer)
									auditElementChar = "P";
									auditElement.actual_scorer = scoreData[scoreIdx].actual_scorer;
								}
							else{
								//covered by lead (and insert actual_scorer)
								auditElementChar = "C";
								auditElement.actual_scorer = scoreData[scoreIdx].actual_scorer;
							}		
					}
					else{
						auditElementChar = "N";
					}
					
					//set auditElement's char to what we set above, then push to member array
					auditElement.char = auditElementChar;
					thisMemberArr.push(auditElement);
					
					/*
					if (scoreData[scoreIdx].data)
						if (scoreData[scoreIdx].assigned_scorer == scoreData[scoreIdx].actual_scorer)
							thisMemberArr.push("Y");
						else
							// 2019-03-16 JL: App crashed due to actual_scorer being undefined
							if (scoreData[scoreIdx].actual_scorer == undefined){
								res.log(`${thisFuncName} actual_scorer undefined`);
								thisMemberArr.push("N");
							}
							// 2018-03-22, M.O'C: Adding parent option
							else if (scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('mr') || 
								scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('mrs') || 
								scoreData[scoreIdx].actual_scorer.toLowerCase().startsWith('ms'))
								thisMemberArr.push("P");
							else
								thisMemberArr.push("C");
					else{
						thisMemberArr.push("N");
					}
						
					*/
				}
				// Write in the last set of records
				var thisRow = {};
				thisRow['member'] = lastMember;
				thisRow['record'] = thisMemberArr;
				memberArr.push(thisRow);
			}
			
			res.render('./admin/audit',{
				title: "Scoring Audit",
				audit: memberArr
			});
		});
	});
});

module.exports = router;
