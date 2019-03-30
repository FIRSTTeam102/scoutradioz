var express = require("express");
var router = express.Router();

router.get("/", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var db = req.db;
	
	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
	//Gets collection ("table") from db
	var collection = db.get("teammembers");	
	
	collection.find({},{sort: {"name": 1}}, function(e, docs){
		
		if(e){ //if error, log to console
			res.log(e);
		}
		teamMembers = docs;
		
		res.render("./admin/members", { 
			title: "Team Members",
			"members": teamMembers 
		});
	});
});

router.get("/present", function(req, res) {
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var db = req.db;
		
	var collection = db.get("teammembers");
	
	collection.find({}, {sort: {"name": 1}}, function(e, docs) {
		if(e)
			res.log(e);
		
		teammembers = docs;
		
		res.render("./admin/present", {
			title: "Assign Who Is Present",
			"members": teammembers
		});
	});
});

router.post("/updatepresent", function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var db = req.db;
	
	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
	var collection = db.get("teammembers");
	
	collection.bulkWrite([{updateMany:{filter:{}, update:{ $set: { "present" : "false" } }}}], function(e, docs){
		for(var i in req.body){
			res.log(i);
			collection.update({"_id": i}, {$set: {"present": "true"}});
		}
		
		res.redirect("./present");
	});
	
});

router.post("/addmember", function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "teammembers.addmember[post]: ";
	res.log(thisFuncName + 'ENTER')

	var db = req.db;
	
	if(db._state == 'closed'){ //If database does not exist, send error
		res.render('./error',{
			message: "Database error: Offline",
			error: {status: "If the database is running, try restarting the Node server."}
		});
	}
	
	var collection = db.get("teammembers");
	
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
	collection.insert({"name": name, "subteam": subteam, "className": className, "years": years, "seniority": seniority, "password": "default", "assigned": "false"});
	
	res.redirect("./");
});

router.post("/updatemember", function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var thisFuncName = "teammembers.updatemember[post]: ";
	res.log(thisFuncName + 'ENTER')
	
	var db = req.db;
	
	if (db._state == "closed"){
		res.render("./error",{
			message: "database error: offline",
			error: {status: "if the database is running, try restarting the node server"}
		});
	}
	
	var collection = db.get("teammembers");
	
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
	
	collection.update({"_id": memberId}, {$set: {"name": name, "subteam": subteam, "className": className, "years": years, "seniority": seniority}});
	
	res.redirect("./");
});

router.post("/deletemember",function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	var db = req.db;
	
	if (db._state == "closed"){
		res.render("./error",{
			message: "database error: offline",
			error: {status: "if the database is running, try restarting the node server"}
		});
	}

	var teammembers = db.get("teammembers");
	
	if(req.body.memberId){

		var memberId = req.body.memberId;
		
		//log it
		res.log(`Request to delete member ${memberId} by user ${req.user}`, true);
		
		res.log("Going to remove member with id: "+memberId, "white");

		teammembers.remove({"_id": memberId}, {}, function(err){
			res.log("callback", "red");
			if(err){
				res.log(err, "red");
				return res.send(500);
			}else{
				return res.redirect('/admin/teammembers');
			}
		});
	}
	
});

module.exports = router;
