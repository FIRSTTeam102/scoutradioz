const express = require('express');
const logger = require('log4js').getLogger();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const router = express.Router();

router.all('/*', wrap(async (req, res, next) => {
	//Require global-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	//res.redirect('/manage');
	res.render('./admin/admindashboard', { 
		title: `Administration`
	});
	
}));

module.exports = router;