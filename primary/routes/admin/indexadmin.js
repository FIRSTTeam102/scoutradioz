const express = require('express');
const router = express.Router();

router.get('/', async function(req, res) {
	
	res.redirect('/manage');
	
});

module.exports = router;