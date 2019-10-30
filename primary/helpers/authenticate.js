const logger = require('log4js').getLogger();

module.exports = function (req, res, next) {
	var authenticate = async function(accessLevel){
		
		var req = this, res = this.res;
		
		var isAuthenticated = false;
		
		//Parse number from accessLevel
		accessLevel = parseInt( accessLevel );
		
		//Throw if access level is not a valid number (Programming error)
		if( isNaN(accessLevel) ) throw new Error("req.authenticate: Access level is not a number (Check naming of process.env.ACCESS_X)");
		
		var user = req.user;
		
		//If user is undefined, create object to avoid errors
		if(!user) user = {};
		
		//Get information about user's role
		var userRole = user.role;
			
		//If userRole is undefined, create object to avoid errors
		if(!userRole) userRole = {};
		
		//Log authentication request
		logger.info(`User ${user.name} (${userRole.access_level}) has requested access to '${req.path}' (${accessLevel})`);
		
		//If user has the correct access level, then set isAuthenticated to true
		if( userRole.access_level >= accessLevel ){
			
			isAuthenticated = true;
		}
		
		//Finally, check if isAuthenticated is true, and return a value corresponding to it
		if( isAuthenticated ){
			
			return true;
		}
		//If user does not have the correct access level, then handle redirection and return false
		else{
			
			var redirectMessage, redirectURL;
			
			switch( accessLevel ){
				case parseInt(process.env.ACCESS_VIEWER):
					redirectURL = req.originalUrl;
					break;
				case parseInt(process.env.ACCESS_SCOUTER):
					redirectMessage = "Sorry, you must log in as a scouter to access this page."
					break;
				case parseInt(process.env.ACCESS_TEAM_ADMIN):
				case parseInt(process.env.ACCESS_GLOBAL_ADMIN):
					redirectMessage = "Sorry, you do not have access to this page."
					break;
			}
			
			var url = `/?alert=${redirectMessage}&redirectURL=${redirectURL}`;
			
			res.redirect(401, url);
			
			return false;
		}
	}
	
	Object.defineProperty(req, 'authenticate', {
		value: authenticate,
		writable: false
	});
	
	next();
}