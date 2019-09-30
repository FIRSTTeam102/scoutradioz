const router = require("express").Router();
const utilities = require("../../utilities");

//DONE
router.get("/", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var org_key = req.user.org_key;
	
	var orgMembers = await utilities.find("users", {org_key: org_key, name: {$ne: "default_user"}}, {sort: {"name": 1}})
	var org = await utilities.findOne("orgs", {org_key: org_key});
	
	var config = org.config.members;
	/*This is the organization's configuration for member information.
	  Currently, it contains:
	  	{ "members": { 
			"subteams": [
				{ "label": "Mechanical", "subteam_key": "mech" },
				{ "label": "Electrical", "subteam_key": "elec" }, 
				{ "label": "Programming", "subteam_key": "prog" }, 
				{ "label": "Drive", "subteam_key": "driv" }
			], 
			"classes": [
				{ "label": "Freshman", "class_key": "freshman" },
				{ "label": "Sophomore", "class_key": "sophomore" },
				{ "label": "Junior", "class_key": "junior" }, 
				{ "label": "Senior", "class_key": "senior" },
				{ "label": "Alum", "class_key": "alum" }, 
				{ "label": "Middle School", "class_key": "middleschool" }, 
				{ "label": "Mentor", "class_key": "mentor" }, 
				{ "label": "Parent", "class_key": "parent" }
		]}} 
	*/
	
	res.render("./manage/members", { 
		title: "Organization Members",
		members: orgMembers,
		config: config,
	});
});

router.post("/addmember", async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
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
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "teammembers.updatemember[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var org_key = req.user.org_key;
	var memberId = req.body.memberId;
	var name = req.body.name;
	var subteam_key = req.body.subteam_key;
	var class_key = req.body.class_key;
	var years = req.body.years;
	
	// recalculate seniority
	var seniority = years;
	// sanity-check! use '0' if it's not already a parseable int
	if (isNaN(parseInt(seniority))) seniority = "0";
	
	// Get the first 3 characters, all lower case
	var classPre = class_key.toLowerCase().substring(0, 3);
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
	
	//Query to update user in db
	var updateQuery = {$set: 
		{name: name,
		org_info: {
			subteam_key: subteam_key,
			class_key: class_key,
			years: years,
			seniority: seniority
		}
	}};
	
	//log it
	res.log(`Request to update member ${memberId} with details ${JSON.stringify(updateQuery)}`, true);
	
	var writeResult = await utilities.update("users", {org_key: org_key, _id: memberId}, updateQuery);
	
	console.log(writeResult);
	
	res.send({
		status: 200,
		message: `Updated ${name} successfully.`
	});
});

router.post("/deletemember", async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	if(req.body.memberId){
		
		var memberId = req.body.memberId;
		
		//log it
		res.log(`Request to delete member ${memberId} by user ${req.user}`, true);
		
		res.log("Going to remove member with id: "+memberId, "white");
		
		await utilities.remove("teammembers", {"_id": memberId}, {});
		
	}
	
	res.redirect('/manage/members');
});

router.get("/present", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var teamMembers = await utilities.find("teammembers", {}, {sort: {"name": 1}});
	
	res.render("./manage/present", {
		title: "Assign Who Is Present",
		"members": teamMembers
	});
});

router.post("/updatepresent", async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
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

module.exports = router;
