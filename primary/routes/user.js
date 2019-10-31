const express = require('express');
const router = express.Router();
const utilities = require('../utilities');
const bcrypt = require('bcryptjs');
const logger = require('log4js').getLogger();

//Redirect to index
router.get('/', async function(req, res){
	res.redirect(301, "/");
});

//no longer used bb
router.get('/selectorg', async function(req, res) {
	
	res.redirect(301, '/')
});

router.get('/login', async function (req, res){
	
	var thisFuncName = 'user.js:login: ';
	
	logger.debug(`${thisFuncName} ENTER`);
	
	//If there is no user logged in, send them to select-org page
	if( !req.user ){
		return res.redirect('/??alert=Please select an organization to sign in to.');
	}
	//If the user logged in is NOT default_user, then send them to index.
	else if( req.user.name != "default_user" ){
		return res.redirect('/?alert=Please log out before you can sign in to another user.');
	}
	//Otherwise, proceed.
	
	//Get organization that user has picked
	var org_key = req.user.org_key;
	logger.debug(`User's organization: ${org_key}`);
	
	//search for organization in database
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.status(500).send("Invalid organization");
	
	res.render('./user/login', {
		title: `Log In to ${selectedOrg.nickname}`,
		redirectURL: req.query.redirectURL
	});
});

router.post('/login', async function(req, res){
	
	//Redirect to /user/login/select via POST (will preserve request body)
	res.redirect(307, '/user/login/select');
});

router.post('/login/select', async function(req, res){
	//This URL can only be accessed via a POST method, because it requires an organization's password.
	var thisFuncName = 'user.js:login/select[POST]: ';
	
	logger.debug(`${thisFuncName} ENTER`);
	
	//this can only be accessed if someone has logged in to default_user'
	if( !await req.authenticate( process.env.ACCESS_VIEWER ) ) return null;
	
	//get contents of request and selected organization
	var org_key = req.user.org_key;
	var org_password = req.body.org_password;
	
	//Make sure that form is filled
	if(!org_key || !org_password || org_key == "" || org_password == ""){
		return res.redirect('/user/login?alert=Please select an organization and enter your organization\'s password.');
	}
	
	//If form is filled, then proceed.
	
	//Get org that matches request
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.redirect(500, '/user/selectorg');
	
	var passwordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	var comparison = await bcrypt.compare( org_password, passwordHash );
	
	//If comparison succeeded, then proceed
	if(comparison == true){
		
		var users = await utilities.find('users', {"org_key": org_key, name: {$ne: "default_user"}}, {sort: {name: 1}});
				
		res.render('./user/selectuser', {
			title: `Sign In to ${selectedOrg.nickname}`,
			org: selectedOrg,
			users: users,
			org_password: org_password, //Must be passed back to user so they can send org's password back with their request (Avoid dealing with tokens & cookies)
			redirectURL: req.body.redirectURL,
		});
	}
	//If failed, then redirect with alert
	else{
		res.redirect(`/user/login?alert=Incorrect password for organization ${selectedOrg.nickname}`);
	}
})

router.post('/login/withoutpassword', async function(req, res){
	
	var thisFuncName = 'user.js:/login/withoutpassword[POST]: ';
	
	//This is where /user/login/selectuser sends a request first
	var userID = req.body.user;
	var org_key = req.body.org_key;
	var org_password = req.body.org_password;
	
	logger.debug(`${thisFuncName} userID=${userID}`);
	
	//If we don't have organization info, redirect user to login
	if(!org_key || !org_password){
		return res.send({
			status: 400,
			redirect_url: "/user/login?alert=Sorry, please re-submit your organization login information."
		});
	}
	
	//If no user is selected, send an alert message
	if(!userID || userID == ''){
		return res.send({
			status: 400,
			alert: "Please select a user."
		});
	}
	
	//Get org that matches request
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	
	//If organization does not exist, send internal error
	if(!selectedOrg) return res.redirect(500, '/user/login');
	
	var passwordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	var comparison = await bcrypt.compare( org_password, passwordHash );
	
	//If password isn't correct for some reason, then cry
	if(!comparison){
		return res.send({
			status: 400,
			redirect_url: "/user/login?alert=Sorry, please re-submit your organization login information."
		});
	}
	
	//Find user info that matches selected id
	var user = await utilities.findOne("users", {_id: userID});
	
	//if user doesn't exist in database for some reason, then cry
	if(!user){
		return res.send({
			status: 400,
			alert: "No such user exists"
		});
	}
	
	logger.debug(`${thisFuncName} user: ${JSON.stringify(user)}`);
	
	//Get role information from database, and compare to access role for a scouter
	var role_key = user.role_key;
	var userRole = await utilities.findOne("roles", {role_key: role_key});
	
	//If no such role exists, throw an error because there must be one
	if(!userRole) throw new Error(`user.js /login/withoutpassword: No role exists in DB with key ${role_key}`);
	
	//if user's access level is greater than scouter, then a password is required.
	if(userRole.access_level > process.env.ACCESS_SCOUTER){
		
		//if user does not have a password but NEEDS a password, then they will need to create one
		if( user.password == "default" ){
			res.send({
				status: 200,
				create_password: true
			});
		}
		//if user has a non-default password, then they will need to enter it
		else{
			res.send({
				status: 200,
				password_needed: true
			});
		}
	} 
	else if(userRole.access_level == process.env.ACCESS_SCOUTER){
		
		//First, check if the user has a password that is default
		if( user.password == "default"){
			
			logger.debug(`${thisFuncName} Logging in scouter`);
		
			//If password is default, then we may proceed
			req.logIn(user, function(err){
				
				//If error, then log and return an error
				if(err){ console.error(err); return res.send({status: 500, alert: err}) };
				
				logger.debug(`${thisFuncName} Sending success/password_needed: false`)
				logger.info(`${thisFuncName} ${user.name} has logged in`);
				
				var redirectURL;
				//if redirectURL has been passed from another function then send it back
				if (req.body.redirectURL) {
					redirectURL = req.body.redirectURL;
				}
				else {
					redirectURL = '/dashboard';
				}
				
				//now, return succes with redirect to dashboard
				res.send({
					status: 200,
					password_needed: false,
					redirect_url: redirectURL,
				});
			});
		}
		else{
			
			logger.debug(`${thisFuncName} Sending password_needed: true`);
			
			//if password is not default, then return with password needed.
			res.send({
				status: 200,
				password_needed: true
			});
		}
	}
	else{
		
		logger.debug(`${thisFuncName} Logging in viewer`)
		
		//if access_level < process.env.ACCESS_SCOUTER, then log in user
		req.logIn(user, function(err){
			
			//If error, then log and return an error
			if(err){ console.error(err); return res.send({status: 500, alert: err}) };
			
			logger.info(`${thisFuncName} ${user.name} has logged in`);
			
			//Now, return with redirect_url: '/'
			res.send({
				status: 200,
				password_needed: false,
				redirect_url: '/'
			});
		});
	}
});

router.post('/login/withpassword', async function(req, res){
	
	var thisFuncName = 'user.js/login/withpassword[POST]: ';
	
	var userID = req.body.user;
	var userPassword = req.body.password;
	var org_key = req.body.org_key;
	var org_password = req.body.org_password;
	
	logger.debug(`${thisFuncName} userID=${userID}`);
	logger.debug(`${thisFuncName} password=${userPassword}`);
	
	//If we don't have organization info, redirect user to login
	if(!org_key || !org_password){
		return res.send({
			status: 400,
			redirect_url: "/user/login?Sorry, please re-submit your organization login information."
		});
	}
	
	//If no user is selected, send an alert message
	if(!userID || userID == ''){
		return res.send({
			status: 400,
			alert: "Please select a user."
		});
	}
	
	//Get org that matches request
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	if(!selectedOrg) return res.redirect(500, '/user/login');
	
	var orgPasswordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	var orgComparison = await bcrypt.compare( org_password, orgPasswordHash );
	
	//If password isn't correct for some reason, then cry
	if(!orgComparison){
		return res.send({
			status: 400,
			redirect_url: "/user/login?Sorry, please re-submit your organization login information."
		});
	}
	
	//Find user info that matches selected id
	var user = await utilities.findOne("users", {_id: userID});
	
	//if user doesn't exist in database for some reason, then cry
	if(!user || !user.password){
		return res.send({
			status: 400,
			alert: "No such user exists"
		});
	}
	
	//Compare passwords
	var userComparison = await bcrypt.compare( userPassword, user.password );
	
	logger.debug(`${thisFuncName} user=${JSON.stringify(user)}, password comparison:${userComparison}`);
	
	if(userComparison){
		
		logger.debug(`${thisFuncName} Logging in`);
		
		//If comparison succeeded, then log in user
		req.logIn(user, async function(err){
			
			//If error, then log and return an error
			if(err){ logger.error(err); return res.send({status: 500, alert: err}) };
			
			var userRole = await utilities.findOne("roles", {role_key: user.role_key});
			
			var redirectURL;
			
			//Set redirect url depending on user's access level
			if (req.body.redirectURL) redirectURL = req.body.redirectURL;
			else if (userRole.access_level == process.env.ACCESS_GLOBAL_ADMIN) redirectURL = '/admin';
			else if (userRole.access_level == process.env.ACCESS_TEAM_ADMIN) redirectURL = '/manage';
			else if (userRole.access_level == process.env.ACCESS_SCOUTER) redirectURL = '/dashboard';
			else redirectURL = '/home';
			
			logger.info(`${user.name} has logged in with role ${userRole.label} (${userRole.access_level}) and is redirected to ${redirectURL}`);
			
			//send success and redirect
			return res.send({
				status: 200,
				redirect_url: redirectURL
			});
		});
	}
	else{
		
		logger.debug(`${thisFuncName} Login failed`);
		
		//If authentication failed, then send alert
		return res.send({
			status: 400,
			alert: "Incorrect password."
		});
	}
});

router.post('/login/createpassword', async function(req, res) {
	
	var thisFuncName = 'user.js/login/createpassword[POST]: ';
	
	var userID = req.body.user;
	var org_key = req.body.org_key;
	var org_password = req.body.org_password;
	var p1 = req.body.newPassword1;
	var p2 = req.body.newPassword2;
	
	logger.info(`${thisFuncName} Request to create password: ${JSON.stringify(req.body)}`);
	
	//If we don't have organization info, redirect user to login
	if(!org_key || !org_password){
		return res.status.send({
			status: 400,
			redirect_url: "/user/login?Sorry, please re-submit your organization login information."
		});
	}
	
	//If no user is selected, send an alert message
	if(!userID || userID == ''){
		return res.send({
			status: 400,
			alert: "Please select a user."
		});
	}
	
	//Get org that matches request
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	if(!selectedOrg) return res.redirect(500, '/user/login');
	
	var orgPasswordHash = selectedOrg.default_password;
	
	//Compare password to correct hash
	var orgComparison = await bcrypt.compare( org_password, orgPasswordHash );
	
	//If password isn't correct for some reason, then cry
	if(!orgComparison){
		return res.send({
			status: 400,
			redirect_url: "/user/login?Sorry, please re-submit your organization login information."
		});
	}
	
	//Find user info that matches selected id
	var user = await utilities.findOne("users", {_id: userID});
	
	//if user doesn't exist in database for some reason, then cry
	if(!user){
		return res.send({
			status: 500,
			alert: "No such user exists"
		});
	}
	
	if(user.password != "default"){
		return res.send({
			password_needed: true,
			alert: "Password already exists. Please submit your current password."
		});
	}
	
	//make sure forms are filled
	if( !p1 || !p2 ){
		return res.send({
			alert: "Please fill both password forms."
		});
	}
	if( p1 != p2 ){
		return res.send({
			alert: "Both new password forms must be equal."
		});
	}
	
	//Hash new password
	const saltRounds = 10;
	
	var hash = await bcrypt.hash( p1, saltRounds );
	
	var writeResult = await utilities.update("users", {_id: userID}, {$set: {password: hash}});
	
	logger.debug(`${p1} -> ${hash}`);
	logger.debug("createpassword: " + JSON.stringify(writeResult, 0, 2));
	
	req.logIn(user, function(err){
		
		if(err) res.log(err);
		
		res.send({
			redirect_url: "/?alert=Set password successfully."
		});
	})
});

/**
 * User page to change your own password.
 * @url /login/changepassword
 * @view /login/changepassword
 *
 */
router.get('/changepassword', async function(req, res){
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	res.render('./user/changepassword', {
		title: "Change Password"
	});
});

//Page to change your own password.
router.post('/changepassword', async function(req, res){
	if( !await req.authenticate( process.env.ACCESS_SCOUTER ) ) return;
	
	var currentPassword = req.body.currentPassword;
	var p1 = req.body.newPassword1;
	var p2 = req.body.newPassword2;
	
	//make sure forms are filled
	if( !p1 || !p2 ){
		return res.redirect("/user/changepassword?alert=Please enter new password.");
	}
	if( p1 != p2 ){
		return res.redirect("/user/changepassword?alert=Both new password forms must be equal.");
	}
	
	var passComparison;
	
	//if user's password is set to default, then allow them to change their password
	if( req.user.password == "default"){
		passComparison = true;
	}
	else{
		passComparison = await bcrypt.compare(currentPassword, req.user.password);
	}
	
	if( !passComparison ){
		return res.redirect('/user/changepassword?alert=Current password incorrect.');
	}
	
	//Hash new password
	const saltRounds = 10;
	
	var hash = await bcrypt.hash( p1, saltRounds );
	
	var writeResult = await utilities.update("users", {_id: req.user._id}, {$set: {password: hash}});
	
	logger.debug("changepassword: " + JSON.stringify(writeResult), true);
	
	res.redirect('/?alert=Changed password successfully.');
});

//Log out
router.get("/logout", async function(req, res) {
	//Logout works a bit differently now.
	//First destroy session, THEN "log in" to default_user of organization.
	
	if( !req.user ) return res.redirect('/');
	
	var org_key = req.user.org_key;
	
	//destroy session
	req.logout();
	
	//req.session.destroy(async function (err) {
	//	if (err) { return next(err); }
		
	//after current session is destroyed, now re log in to org
	var selectedOrg = await utilities.findOne('orgs', {"org_key": org_key});
	if(!selectedOrg) return res.redirect(500, '/');
	
	var defaultUser = await utilities.findOne('users', {"org_key": org_key, name: "default_user"});
	if(!defaultUser) return res.redirect(500, '/');
	
	
	//Now, log in to defaultUser
	req.logIn(defaultUser, async function(err){
			
		//If error, then log and return an error
		if(err){ console.error(err); return res.send({status: 500, alert: err}) };
		
		//now, once default user is logged in, redirect to index
		res.redirect('/');
	});
	//});
});

//Switch a user's organization
router.get('/switchorg', async function(req, res){
	
	//This will log the user out of their organization.
	
	//destroy session
	req.logout();
	
	req.session.destroy(async function (err) {
		if (err) return console.log(err);
		
		//clear org_key cookie
		logger.debug(`Clearing org_key cookie`);
		res.clearCookie("org_key");
		
		//now, redirect to index
		res.redirect('/');
	});
})

/**
 * Admin page to reset another user's password.
 * @url /login/resetpassword
 * @view /login/resetpassword
 * @db teammembers
 *
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
 *
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

*/

module.exports = router;