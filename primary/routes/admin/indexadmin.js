const express = require('express');
const router = express.Router();

router.get('/', async function(req, res) {
	
	//res.redirect('/manage');
	res.render('./admin/admindashboard', { 
		title: `Administration`
	});
	
});

module.exports = router;