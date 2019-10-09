const passport = require('passport');
//const LocalStrategy = require('passport-local').Strategy; //strategy for passport
const utilities = require("../utilities");

// Creates the data necessary to store in the session cookie
passport.serializeUser(function(user, done) {
	//if we switch to mongoose, change to done(null, user.id);
	console.log("serializeUser:"+user._id);
    done(null, user._id);
});

// Reads the session cookie to determine the user from a user ID
passport.deserializeUser(async function(id, done) {
	
	var user = await utilities.findOne("users", { "_id": id }, {});
	
	if(!user){
		console.error("User not found in db: deserializeUser " + id);
		done("User not found in db: deserializeUser " + id, null);
	}
	else
		done(null, user);
		
});