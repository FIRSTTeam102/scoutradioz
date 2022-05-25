import passport from 'passport';
import { getLogger } from 'log4js';
import utilities from '@firstteam102/scoutradioz-utilities';

const logger = getLogger('passport');

// Creates the data necessary to store in the session cookie
passport.serializeUser(function(user, done) {
	//if we switch to mongoose, change to done(null, user.id);
	logger.trace('serializeUser: ' + user._id);
	done(null, user._id);
});

// Reads the session cookie to determine the user from a user ID
passport.deserializeUser(async function(id, done) {
	
	logger.trace('deserializeUser: ' + id);
	
	// JL note: Can't declare the type of this one because of the slight type differences between our extended express.User object (namespace-extensions.d.ts) and our regular User object in the DB
	let user = await utilities.findOne('users', { '_id': id }, {}, {allowCache: true});
	
	if(!user){
		logger.error('User not found in db: deserializeUser ' + id);
		done('User not found in db: deserializeUser ' + id, null);
	}
	else
		done(null, user);
});