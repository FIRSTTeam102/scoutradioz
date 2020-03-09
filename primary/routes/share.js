const router = require('express').Router();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const logger = require('log4js').getLogger();

router.get('/*', wrap(async (req, res, next) => {
	
	logger.info(req.url);
	var url = req.url;
	var urlBits = url.split('/');
	
	//remove empty bit of url
	if (urlBits[0] == '') {
		urlBits.shift(0, 1);
	}
	logger.info(urlBits);
	
	//Get orgKey and remove it from urlBits
	var orgKey = urlBits.shift(0, 1);
	
	//if user is not logged in OR logged-in user is part of a DIFFERENT org:
	if (!req.user || req.user.org_key != orgKey) {
	
		var org = await utilities.findOne('orgs', {org_key: orgKey});
		
		//If org was found
		if (org) {
			//if there is a trailing url, set it as redirect
			if (urlBits.length > 0) {
				var redirectURL = '/' + urlBits.join('/');
				res.redirect(`/selectorg?org_key=${orgKey}&redirectURL=${redirectURL}`);
			}
			//If no trailing url, just log in to org and go to home screen
			else {
				res.redirect(`/selectorg?org_key=${orgKey}`);
			}
		}
		//If org was not found, skip this function
		else {
			next();
		}
	}
	//If logged-in user is already part of the same org:
	else {
		//if there is a trailing url, set it as redirect
		if (urlBits.length > 0) {
			var redirectURL = '/' + urlBits.join('/');
			res.redirect(`/?redirectURL=${redirectURL}`);
		}
		//If no trailing url, just go to home screen
		else {
			res.redirect('/');
		}
	}
}));

module.exports = router;