const express = require('express');
const router = express.Router();

router.get('/', async function(req, res) {
	
	res.send('<a href="/">Succ-ess</a>');
	
});

module.exports = router;