var express = require('express');
var router = express.Router();

router.get('/', async function(req, res) {
	
	console.log(req.query);
	
	res.send(req.query);
	
});

router.post('/', async function(req, res) {
	
	console.log(req.body);
	
	res.send(req.body);
	
});

module.exports = router;