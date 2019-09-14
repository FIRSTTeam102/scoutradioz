var passport = require('passport');

/** For each scouter or admin page, this function exists to check
 *  if a user is logged in. 
 * @param type Type of page: 'admin' or 'scouter'
 * 
 USE:
 At the start of each non-public page, copy one of these:

	if(!require('./checkauthentication')(req, res, 'scouter')){
		return null;
	}
	
	if(!require('./checkauthentication')(req, res, 'admin')){
		return null;
	}

IF THE ROUTE EXISTS WITHIN A SUBFOLDER: Use '../checkauthentication' 
because it has to backtrack one folder. 

 */
module.exports = function(req, res, type){
	
	res.send(`checkauthentication.js is no longer supported`);
	return false;
    
	//if dev server, always return true.
	if(req.app.isDev){
		return true;
	}

	//Check if user is logged in
	if(req.user){

		if( type == 'admin' ){

			//if page is admin and user is admin, return true
			if( req.user.subteam == 'support' || req.user.subteam == 'exec' )
				return true;
			else
				return res.redirect('/?alert=You do not have access to this page.');
		}
		else{
			//if user is logged in, allow no matter what type user is
			return true;
		}
	}
	else{
        //isn't logged in; redirect to homepage w/ message
        return res.redirect('/?alert=You must log in to access this page.');
	}
}