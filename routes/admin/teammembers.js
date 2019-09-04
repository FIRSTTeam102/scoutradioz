const router = require("express").Router();
const utilities = require("../../utilities");

router.get("/", async function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	var teamMembers = await utilities.find("teammembers", {}, {sort: {"name": 1}});
	
	res.render("./admin/members", { 
		title: "Team Members",
		"members": teamMembers 
	});
});

router.get("/present", async function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	var teamMembers = await utilities.find("teammembers", {}, {sort: {"name": 1}});
		
	res.render("./admin/present", {
		title: "Assign Who Is Present",
		"members": teamMembers
	});
});

router.post("/updatepresent", async function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	await utilities.update("teammembers", {}, { $set: { "present" : "false" } }, {multi: true});
	
	//Get a list of all present member IDs.
	var allPresentMembers = [];
	for(var i in req.body) allPresentMembers.push(i);
	
	res.log(`updatepresent: allPresentMembers: ${JSON.stringify(allPresentMembers)}`);
	
	var query = {"_id": {$in: allPresentMembers}};
	var update = {$set: {"present": "true"}};
	
	await utilities.update("teammembers", query, update, {multi: true});
	
	res.redirect("./present");
});

router.post("/addmember", async function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "teammembers.addmember[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var name = req.body.name;
	var subteam = req.body.subteam;
	var className = req.body.className;
	var years = req.body.years;
	
	var memberJson = JSON.stringify(req.body);
	res.log(`Request to add member ${memberJson}`, true);

	// calculate seniority
	var seniority = years;
	// sanity-check! use '0' if it's not already a parseable int
	if (isNaN(parseInt(seniority))) seniority = "0";
	
	// Get the first 3 characters, all lower case
	var classPre = className.toLowerCase().substring(0, 3);
	switch(classPre) {
		case "fre":
			seniority += ".1";
			break;
		case "sop":
			seniority += ".2";
			break;
		case "jun":
			seniority += ".3";
			break;
		case "sen":
			seniority += ".4";
			break;
		default:
			seniority += ".0";
	}
	res.log(thisFuncName + 'seniority=' + seniority);
	
	// 2018-04-05, M.O'C - Adding "assigned" as "false" so that the field has a value upon insert
	await utilities.insert("teammembers", {"name": name, "subteam": subteam, "className": className, "years": years, "seniority": seniority, "password": "default", "assigned": "false"});
	
	res.redirect("./");
});

router.post("/updatemember", async function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "teammembers.updatemember[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var memberId = req.body.memberId;
	var name = req.body.name;
	var subteam = req.body.subteam;
	var className = req.body.className;
	var years = req.body.years;
	
	//log it
	res.log(`Request to update member ${memberId} with details ${JSON.stringify(req.body)}`, true);
	
	// recalculate seniority
	var seniority = years;
	// sanity-check! use '0' if it's not already a parseable int
	if (isNaN(parseInt(seniority))) seniority = "0";
	
	// Get the first 3 characters, all lower case
	var classPre = className.toLowerCase().substring(0, 3);
	switch(classPre) {
		case "fre":
			seniority += ".1";
			break;
		case "sop":
			seniority += ".2";
			break;
		case "jun":
			seniority += ".3";
			break;
		case "sen":
			seniority += ".4";
			break;
		default:
			seniority += ".0";
	}
	res.log(thisFuncName + 'seniority=' + seniority);
	
	res.log({memberId, name, subteam, className, years});
	
	await utilities.update("teammembers", {"_id": memberId}, {$set: {"name": name, "subteam": subteam, "className": className, "years": years, "seniority": seniority}});
	
	res.redirect("./");
});

router.post("/deletemember", async function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	if(req.body.memberId){
		
		var memberId = req.body.memberId;
		
		//log it
		res.log(`Request to delete member ${memberId} by user ${req.user}`, true);
		
		res.log("Going to remove member with id: "+memberId, "white");
		
		await utilities.remove("teammembers", {"_id": memberId}, {});
		
	}
	
	res.redirect('/admin/teammembers');
});

module.exports = router;
