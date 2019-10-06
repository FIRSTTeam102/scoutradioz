const router = require("express").Router();
const utilities = require("../../utilities");

//DONE
router.get("/", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var org_key = req.user.org_key;
	
	var orgMembers = await utilities.find("users", {org_key: org_key, name: {$ne: "default_user"}}, {sort: {"name": 1}})
	var org = await utilities.findOne("orgs", {org_key: org_key});
	
	var roles = await utilities.find("roles", { access_level: { $lte: req.user.role.access_level }});
	
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
		roles: roles
	});
});

router.post("/addmember", async function(req, res){
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "teammembers.addmember[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var name = req.body.name;
	var subteam_key = req.body.subteam_key;
	var class_key = req.body.class_key;
	var years = req.body.years;
	var role_key = req.body.role_key;
	
	var org_key = req.user.org_key;
	
	if(!name || name == ""){
		return res.send({
			status: 400, message: "User must have a name."
		});
	}
	
	var requestedRole = await utilities.findOne("roles", {role_key: role_key});
	
	if( !requestedRole ){
		return res.redirect("/manage/members?alert=Invalid role requested.");
	}
	if( requestedRole.access_level > req.user.role.access_level ){
		return res.redirect("/manage/members?alert=You do not have permission to create a user with that role.");
	}
	
	var memberJson = JSON.stringify(req.body);
	res.log(`Request to add member ${memberJson}`, true);

	// calculate seniority
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
	res.log(thisFuncName + 'seniority=' + seniority);
	
	var insertQuery = {
		org_key: org_key,
		name: name,
		role_key: role_key,
		password: "default",
		org_info: {
			subteam_key: subteam_key,
			class_key: class_key,
			years: years,
			seniority: seniority
		},
		event_info:{
			present: false,
			assigned: false
		}
	}
	
	var writeResult = await utilities.insert("users", insertQuery);
	
	res.redirect('/manage/members');
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
		
		var member = await utilities.findOne("users", {_id: memberId});
		var memberRole = await utilities.findOne("roles", {role_key: member.role_key});
		
		//log it
		res.log(`Request to delete member ${memberId} by user ${req.user}`, true);
		
		if( req.user.role.access_level >= memberRole.access_level ){
			
			var writeResult = await utilities.remove('users', {_id: memberId});
			
			res.redirect('/manage/members?alert=Removed user successfully.');
		}
		else{
			
			res.redirect('/manage/members?alert=Unauthorized to delete this user.');
		}
	}
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
