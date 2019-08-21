var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var utilities = require("../utilities");

/**
 * Regular user login.
 * @url /login/scouter
 * @view /login/login
 */
router.get('/scouter', async function(req, res) {
	
	//If there's been a GET request, prepare an alert
	if(req.query)
		var alert = req.query.alert || null;
	
	var users = await utilities.find("teammembers", {}, {sort:{ "name": 1 }});
	
	res.render('./login/login', { 
		members: users,
		title: "Scouter Login",
		alert: alert
	});
});

router.get('/admin', async function(req, res) {

	//If there's been a GET request, prepare an alert
	if(req.query)
		var alert = req.query.alert || null;
		
	var users = await utilities.find("teammembers", {subteam: {$in: ["exec", "support"]} }, {sort: { password: -1, name: 1}});
	
	res.render('./login/login', { 
		title: "Admin Login",
		members: users,
		alert: alert
	});
});

/**
 * Admin page to add a new admin user.
 * @url /login/adduser
 * @view /login/adduser
 */
router.get('/adduser', async function(req, res){
	
	if( !require('./checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	res.render('./login/adduser', { 
		title: "Create Admin User"
	});
	
});

/**
 * User page to change your own password.
 * @url /login/changepassword
 * @view /login/changepassword
 */
router.get('/changepassword', async function(req, res){
	
	if( !require('./checkauthentication')(req, res) ){
		return res.log('authentication failed for /login/changepassword');
	}
	
	res.render('./login/changepassword', {
		title: "Change Password"
	});
});

/**
 * Admin page to reset another user's password.
 * @url /login/resetpassword
 * @view /login/resetpassword
 * @db teammembers
 */
router.get('/resetpassword', async function(req, res){
	if( !require('./checkauthentication')(req, res, 'admin') ){
		return res.log('authentication failed for /login/changepassword');
	}
	
	var users = await utilities.find("teammembers", {}, {sort:{ "name": 1 }});
	
	res.render('./login/resetpassword', { 
		members: users,
		title: "Reset Password for Any User"
	});
});

/**
 * POST: Admin page to reset another user's password.
 * @url POST: /login/resetpassword
 * @redirect /
 */
router.post('/resetpassword', async function(req, res){
	if( !require('./checkauthentication')(req, res, 'admin') ){
		return res.log('authentication failed for /login/resetpassword');
	}
	
	var userToReset = req.body.username;
	
	if(!userToReset || userToReset == ""){
		return res.redirect('./resetpassword');
	}
	
	var writeResult = await utilities.update("teammembers", { name: userToReset }, { $set: { password: 'default' } }, {});
	
	res.redirect('/?alert=Password successfully changed for user ' + userToReset);
});

/**
 * POST: Admin page to change your own password.
 * @url POST: /login/changepassword
 * @redirect /
 */
router.post('/changepassword', async function(req, res){
	
	//Grabs both passwords entered
	var p1 = req.body.passwordOne;
	var p2 = req.body.passwordTwo;
	
	//checks if they were entered or not
	if( !p1 || !p2 ){
		return res.render('./login/changepassword', {
			title: "Change Password",
			alert: "Both password forms must be entered."
		});
	}
	//checks if they are equal
	if( p1 != p2 ){
		return res.render('./login/changepassword', {
			title: "Change Password",
			alert: "Both password forms must be equal."
		});
	}
	//just double checks if user is logged in
	if(!req.user){
		return console.error("User doesn't exist in /login/changepassword");
	}
	
	console.log(req.user);
	
	var member = await utilities.find("teammembers", {name: req.user.name}, {});
	
	res.log(`DEBUG - changepassword - member: ${member}`);
	
	member = member[0];
	
	if(!member){
		return res.send(500, "user don't exist");
	}
	else{
		
		res.log(member);
		res.log(member.password);
		
		//Hashes new password
		const saltRounds = 10;
		
		bcrypt.hash(p1, saltRounds, async function(err, hash) {
			
			//if error, err out
			if(err){
				res.log(err, true);
				return res.sendStatus(500);
			}
			
			res.log(hash);
			
			var writeResult = await utilities.update("teammembers", {name: req.user.name}, {$set: {password: hash}}, {});
			
			console.log(writeResult);
			
			//redirect to home
			res.redirect('/?alert=Password changed successfully.');
		});
	}
});

/**
 * POST method to login a scouter
 * @url POST /login/scouter
 * @redirect /dashboard
 */
router.post('/scouter', function(req, res) {
	
	//if form is empty, alert w/ plz login
	if(!req.body.password || !req.body.username){
		return res.redirect('./scouter?alert=Please select a name and enter a password.');
	}
	
	//Request auth for user.
	res.log("Requesting authentication for user: " + req.body.username || "error" );
	
	req.passport.authenticate("local", function(err, user, info) {
            
			// if any problems exist, error out
            if (err) {
				res.sendStatus(500);
				res.log(err);
				return err;
            }
			
			//If user isn't passed, render login with the error message.
            if (!user) {
				var alert = info != undefined ? info.alert || null : null;
				
                return res.redirect('./scouter?alert='+alert);
            }
			
            // log in the user
            req.logIn(user, function(err) {
                if (err) 
					return err;
				
				//if logged in, redirect to scoring app (CURRENTLY INDEX)
				return res.redirect('/dashboard');
				
            });
        })(req, res);
});

/**
 * POST: Admin login page
 * @url POST /login/admin
 * @redirect /admin
 */
router.post('/admin', function(req, res) {
	
	//if form is empty, alert w/ plz login
	if(!req.body.password || !req.body.username){
		return res.redirect('./admin?alert=Please select a name and enter a password.');
	}
	
	//Request auth for user.
	res.log("Requesting authentication for user: " + req.body.username || "error" );
	req.passport.authenticate("local", function(err, user, info) {
            
			// if any problems exist, error out
            if (err) {
				res.send(500);
				return res.log(err);
            }
			
			//If user isn't passed, render login with the error message.
            if (!user) {
				var alert = info != undefined ? info.alert || null : null;
                return res.redirect('./admin/?alert='+alert);
            }
			
            // log in the user
            req.logIn(user, function(err) {
                if (err) 
					return err;
                
				if( user.subteam == 'support' || 'exec'){
					
					//if user is admin (support) send to admin page
					return res.redirect('/admin');
				}
				else{
					//if subteam isn't support, redirect to home with message
					return res.redirect('/?alert=Scouters have to log in with the Scouter login page.');					
				}
            });
        })(req, res);
});

/** 
 * POST: Admin page to add an admin user
 * @url POST /login/adduser
 * @redirect none
 * @view /login/adduser
*/
router.post('/adduser', async function(req, res){
	if( !require('../checkauthentication')(req, res, 'admin') ){
		return null;
	}
	
	//set all attributes that will go into the new user
	var name = req.body.username;
	var subteam = "support";
	var className = req.body.className;
	var years = req.body.years;
	var present = "true";
	var txtPassword = req.body.password;
	
	//if not all the forms are full, reload page
	if(name == null || className == null || years == null || txtPassword == null){
		
		return res.render('./login/adduser', { 
			title: "Create Admin User",
			alert: "You must fill all parameters"
		});
	}
	
	var userThatExists = await utilities.findOne("teammembers", { "name": name }, {});
	
	//if user already exists, reload w/ warning
	if( userThatExists != null ){
		return res.render('./login/adduser', { 
			title: "Create Admin User",
			alert: "Error: User already exists."
		});
	}
		
	//hash password
	const saltRounds = 10;
	
	bcrypt.hash(txtPassword, saltRounds, async function(err, hash) {
		
		//if error, err out
		if(err){
			res.log(err);
			return res.sendStatus(500);
		}
		
		await utilities.insert("teammembers", {
			"name": name,
			"subteam": subteam,
			"className": className,
			"years": years,
			"present": present,
			"password": hash
		});
		
		//return to page
		return res.render('./login/adduser', { 
			title: "Create Admin User",
			alert: "User" + name + " created successfully."
		});
	});
});

module.exports = router;