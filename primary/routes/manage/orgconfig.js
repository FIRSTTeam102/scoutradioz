const express = require('express');
const router = express.Router();
const wrap = require('express-async-handler');
const utilities = require('../../utilities');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	res.redirect('/manage');
	
}));

router.get('/pitsurvey', wrap(async (req, res) => {
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
		
	var org_key = req.user.org_key;

	var year = parseInt(req.query.year || req.event.key)
	
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var pitlayout = await utilities.find("scoutinglayout", {org_key: req.user.org_key, year: year}, {sort: {"order": 1}})
	var pitlayout = await utilities.find("layout", {org_key: org_key, year: year, form_type: "pitscouting"}, {sort: {"order": 1}})
	
	res.render('./manage/config/pitsurvey', {
		title: `Pit Survey Layout`,
		pitlayout: pitlayout,
		year: year
	});
	
}));

module.exports = router;