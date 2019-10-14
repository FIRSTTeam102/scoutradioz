const express = require('express');
const router = express.Router();
const utilities = require('../../utilities');

router.get('/', async function(req, res) {
	
	res.redirect('/manage');
	
});

router.get('/pitsurvey', async function(req, res) {
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
		
	var year = parseInt(req.query.year || req.event.key)
	
	var pitlayout = await utilities.find("scoutinglayout", {org_key: req.user.org_key, year: year}, {sort: {"order": 1}})
	
	res.render('./manage/config/pitsurvey', {
		title: `Pit Survey Layout`,
		pitlayout: pitlayout,
		year: year
	});
	
});

module.exports = router;