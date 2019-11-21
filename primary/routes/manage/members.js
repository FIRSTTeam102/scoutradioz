const router = require("express").Router();
const monk = require("monk");
const logger = require('log4js').getLogger();
const utilities = require("../../utilities");

router.all('/*', async function (req, res, next) {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
})

router.get("/", async function(req, res) {
	
	var org_key = req.user.org_key;
	
	var orgMembers = await utilities.find("users", {org_key: org_key, visible: true}, {sort: {"name": 1}})
	var org = await utilities.findOne("orgs", {org_key: org_key});
	
	var roles = await utilities.find("roles", { access_level: { $lte: req.user.role.access_level }});
	
	var config = org.config.members;
	
	
	var membersByRole = {};
	
	for( var thisRole of roles ){
		
		membersByRole[ thisRole.label ] = [];
		
		for( var thisMember of orgMembers ){
			
			if( thisMember.role_key == thisRole.role_key ){
				
				membersByRole[ thisRole.label ].push( thisMember );
			}
		}
	}
	
	res.render("./manage/members", { 
		title: "Organization Members",
		//members: orgMembers,
		membersByRole: membersByRole,
		config: config,
		roles: roles
	});
});

router.post("/addmember", async function(req, res){
	
	var thisFuncName = "members.addmember[post]: ";
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
		},
		visible: true,
	}
	
	var writeResult = await utilities.insert("users", insertQuery);
	
	res.redirect('/manage/members#addMember');
});

router.post("/updatemember", async function(req, res){
	
	var thisFuncName = "members.updatemember[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var org_key = req.user.org_key;
	var memberId = req.body.memberId;
	var name = req.body.name;
	var subteam_key = req.body.subteam_key;
	var class_key = req.body.class_key;
	var years = req.body.years;
	var role_key = req.body.role_key;
	
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
	
	var existingUserPreEdit = await utilities.findOne("users", {_id: memberId});
	var existingUserRole = await utilities.findOne("roles", {role_key: existingUserPreEdit.role_key});
	
	//Check the role of the user they're trying to edit, and see if they are authorized to edit that user
	if( existingUserRole.access_level > req.user.role.access_level ){
		
		res.send({
			status: 401,
			message: "You do not have permission to edit that user."
		})
	}
	else{
		
		var requestedRole = await utilities.findOne("roles", {role_key: role_key});
		
		//Check the role they're trying to give the user, and see if they are authorized to give that role
		if( !requestedRole || requestedRole.access_level > req.user.role.access_level ){
			res.send({
				status: 401,
				message: "You do not have permission to set a role of this level."
			});
		}
		else{
			//Query to update user in db
			var updateQuery = {
				$set: {
					name: name,
					role_key: role_key,
					org_info: {
						subteam_key: subteam_key,
						class_key: class_key,
						years: years,
						seniority: seniority
					}
				}
			};
			
			//log it
			res.log(`Request to update member ${memberId} with details ${JSON.stringify(updateQuery)}`, true);
			
			var writeResult = await utilities.update("users", {org_key: org_key, _id: memberId}, updateQuery);
			
			console.log(writeResult);
			
			res.send({
				status: 200,
				message: `Updated ${name} successfully.`
			});
		}
	}
});

router.post("/deletemember", async function(req, res){
	
	if(req.body.memberId){
		
		var memberId = req.body.memberId;
		var orgKey = req.user.org_key;
		
		var member = await utilities.findOne("users", {_id: memberId, org_key: orgKey});
		var memberRole = await utilities.findOne("roles", {role_key: member.role_key});
		
		res.log(`Request to delete member ${memberId} by user ${JSON.stringify(req.user)}`, true);
		
		//check for authorization
		if( req.user.role.access_level >= memberRole.access_level ){
			
			//check if someone's trying to delete themselves (Don't do that!)
			if(req.user._id != memberId){
				
				var writeResult = await utilities.remove('users', {_id: memberId});
				
				res.redirect('/manage/members?alert=Removed user successfully.');
			}
			else{
				res.redirect('/manage/members?alert=Don\'t delete yourself, you silly goose!');
			}
		}
		else{
			
			res.redirect('/manage/members?alert=Unauthorized to delete this user.');
		}
	}
});

router.get('/passwords', async function(req, res){
	
	var orgKey = req.user.org_key;
	
	var orgMembers = await utilities.find("users", {org_key: orgKey, visible: true}, {sort: {"name": 1}})
	
	var roles = await utilities.find("roles", { access_level: { $lte: req.user.role.access_level }});
	
	var membersByRole = {};
	
	for( var thisRole of roles ){
		
		membersByRole[ thisRole.label ] = [];
		
		for( var thisMember of orgMembers ){
			
			if( thisMember.role_key == thisRole.role_key ){
				
				membersByRole[ thisRole.label ].push( thisMember );
			}
		}
	}		
	
	res.render("./manage/memberpasswords", { 
		title: "Organization Members",
		//members: orgMembers,
		membersByRole: membersByRole,
		roles: roles
	});
});

router.post('/resetpassword', async function (req, res) {
	const thisFuncName = 'manage/members/resetpassword[POST]: ';
	
	const memberId = req.body.memberId;
	
	try {
		//get info on requested member
		const member = await utilities.findOne('users', {_id: memberId});
		logger.info(`${thisFuncName} Request to reset password of ${member.name} by ${req.user.name}`);
		const memberRole = await utilities.findOne('roles', {role_key: member.role_key});
		
		//check if user is authorized to edit the selected member
		if (memberRole.access_level <= req.user.role.access_level) {
			
			const writeResult = await utilities.update('users', 
				{_id: memberId}, {$set: {'password': 'default'}});
				
			logger.info(`${thisFuncName} Reset password of ${member.name} successfully.`);
			res.send({status: 200, message: "Reset password successfully."});
		}
		//if unauthorized, return unauthorized message
		else {
			logger.info(`${thisFuncName} User ${req.user.name} unauthorized to edit ${member.name}`);
			res.send({status: 401, message: "Unauthorized to edit this user."});
		}
	}
	//catch-all for any other errors
	catch (err) {
		logger.error(err);
		res.send({status: 500, message: err.toString()});
	}
})

router.get("/present", async function(req, res) {
	
	//2019-11-20 JL: updated to only work with members of the right organization.
	const orgKey = req.user.org_key;
	
	var users = await utilities.find("users", {org_key: orgKey, visible: true}, {sort: {"name": 1}});
	logger.trace("members.present: users=" + JSON.stringify(users));

	res.render("./manage/present", {
		title: "Assign Who Is Present",
		"members": users
	});
});

router.post("/updatepresent", async function(req, res){
	
	//2019-11-20 JL: updated to only work with members of the right organization.
	const orgKey = req.user.org_key;
	
	await utilities.update("users", {org_key: orgKey}, { $set: { "event_info.present" : "false" } }, {multi: true});
	
	//Get a list of all present member IDs.
	var allPresentMembers = [];
	for(var i in req.body)
	{
		allPresentMembers.push(monk.id(i));
	}
	
	console.log(`updatepresent: allPresentMembers: ${JSON.stringify(allPresentMembers)}`);
	
	var query = {"_id": {$in: allPresentMembers}, org_key: orgKey};
	var update = {$set: {"event_info.present": true}};
	
	await utilities.update("users", query, update, {multi: true, castIds: true});
	
	res.redirect("./present");
});

module.exports = router;
