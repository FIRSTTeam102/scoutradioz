var express = require('express');
var router = express.Router();

router.get('/', async function(req, res) {
	
	res.redirect('/upload')
	
});

module.exports = router;