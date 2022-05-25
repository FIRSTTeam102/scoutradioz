import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import { Org } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('share');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

router.get('/*', wrap(async (req, res, next) => {
	logger.addContext('funcName', 'root[get]');
	
	let url = req.url;
	let urlBits = url.split('/');
	let redirectURL;
	
	//remove empty bit of url
	if (urlBits[0] == '') {
		urlBits.shift();
	}
	logger.debug(`url=${req.url}, urlBits=${JSON.stringify(urlBits)}`);
	
	//Get orgKey and remove it from urlBits
	let orgKey = urlBits.shift();
	
	//if user is not logged in OR logged-in user is part of a DIFFERENT org:
	if (!req.user || req.user.org_key != orgKey) {
		
		let org: Org = await utilities.findOne('orgs', 
			{org_key: orgKey}, {},
			{allowCache: true, maxCacheAge: 300},
		);
		
		//If org was found
		if (org) {
			//if there is a trailing url, set it as redirect
			if (urlBits.length > 0) {
				redirectURL = '/' + urlBits.join('/');
				
				let alert = `You are viewing ${org.nickname}.\nTo change the organization you wish to view, click *Org: ${org.nickname}* in the menu and select *Change Organization*.`;
				
				// 2022-03-02 JL: We only need to fix the redirectURL if it includes a ? - otherwise, the /page?alert= would turn into /page%3falert= and throw a 404
				if (redirectURL.includes('?')) {
					redirectURL += '&alert=' + alert;
					redirectURL = req.fixRedirectURL(redirectURL);
				}
				else {
					redirectURL += '?alert=' + alert;
				}
				
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
			redirectURL = '/' + urlBits.join('/');
			redirectURL = req.fixRedirectURL(redirectURL); // 2022-02-27 JL: URL encoding ? and & for redirect
			res.redirect(`/?redirectURL=${redirectURL}`);
		}
		//If no trailing url, just go to home screen
		else {
			res.redirect('/');
		}
	}
}));

module.exports = router;