const router = require("express").Router();
const logger = require('log4js').getLogger();
const utilities = require('../../utilities');

router.all('/*', async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
})

/**
 * Scoring audit page.
 * @url /manage/scoringaudit
 * @view /manage/index, /manage/scoringaudit
 */
router.get("/", async function(req, res) {
	
	var thisFuncName = "audit.root[GET]:";
	logger.debug(`${thisFuncName} enter`);
	
	var eventId = req.event.key;
	
	var matches = await utilities.find("matches", { event_key: eventId, "alliances.red.score": -1 }, {sort: {"time": 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (matches && matches[0])
	{
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug("Scoring audit: earliestTimestamp=" + earliestTimestamp);
	
	var scoreData = await utilities.find("scoringdata", {"event_key": eventId, "time": { $lt: earliestTimestamp }}, { sort: {"assigned_scorer": 1, "time": 1, "alliance": 1, "team_key": 1} });
	
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
						logger.debug(`${thisFuncName} actual_scorer undefined`);
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
						logger.debug(`${thisFuncName} actual_scorer undefined`);
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

	res.render('./manage/audit',{
		title: "Scouter Audit",
		audit: memberArr
	});
});

router.get('/bymatch', async function(req, res){
	
	var audit = {};
	var eventId = req.event.key;
	
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matches = await utilities.find("matches", {event_key: eventId, "alliances.red.score": -1}, {sort: {"time": 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	
	if (matches[0]){
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug("Per-match audit: earliestTimestamp=" + earliestTimestamp);
	
	var scoreData = await utilities.find("scoringdata", {"event_key": eventId, "time": { $lt: earliestTimestamp }}, { sort: {"time": 1, "alliance": 1, "team_key": 1} });
	
	//Create array of matches for audit, with each match-team inside each match
	var audit = [];
	
	var lastMatchNum = scoreData[0].match_number;
	
	for(var i = 0, thisAuditIdx = 0; i < scoreData.length; i++){
		
		let thisMatchNum  = scoreData[i].match_number;
		
		//if we finished going through last match, go to next match and create a new array to push to audit
		if(thisMatchNum > lastMatchNum || i == 0){
			lastMatchNum = thisMatchNum;
			
			let matchTeamArr = [];
			
			//go through the next 6 elements in scoreData and add to matchTeamArr
			for(var j = 0; j < 6; j++){
				
				let thisMatchTeam = scoreData[i + j];
				let thisMatchTeamNum = thisMatchTeam.match_number;
				
				//if scoreData[i+j] is the same match as thisMatchNum, insert into matchTeamArr
				if(thisMatchTeamNum == thisMatchNum){
					matchTeamArr.push(thisMatchTeam);
				}
				//if not, JUST IN CASE something went wrong with the data, push an object with scored: false
				else{
					matchTeamArr.push({
						"match_number": thisMatchNum,
						"scored": false
					});
				}
				//this way, each matchTeamArr is 6 objects large
			}
			
			//finally, push matchTeamArr
			audit.push(matchTeamArr);
		}
	}
	
	res.render('./manage/auditbymatch', {
		title: "Match Scouting Audit",
		"audit": audit
	});
})

router.get('/comments', async function(req, res){
	
	var eventId = req.event.key;
	
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matches = utilities.find("matches", {event_key: eventId, "alliances.red.score": -1}, {sort: {"time": 1}});
	
	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	
	if (matches[0]){
		var earliestMatch = matches[0];
		earliestTimestamp = earliestMatch.time;
	}
	
	logger.debug("Comments audit: earliestTimestamp=" + earliestTimestamp);
		
	var scoreData = await utilities.find("scoringdata", {"event_key": eventId, "time": { $lt: earliestTimestamp }}, { sort: {"actual_scorer": 1, "time": 1, "alliance": 1, "team_key": 1} });
	
	var audit = [];
	
	for(var i in scoreData){
		if(scoreData[i].data && scoreData[i].data.otherNotes != ""){
			audit.push(scoreData[i]);
		}
	}
	
	res.render('./manage/auditcomments', {
		title: "Scouter Comments Audit",
		"audit": audit
	});
});


module.exports = router;
