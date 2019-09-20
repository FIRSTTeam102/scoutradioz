const express = require('express');
const router = express.Router();

router.get('/', async function(req, res){
	
	res.render('./notifications', {
		title: "Subscribing to a notification"
	});
});

router.post('/send', async function(req, res){
	
	console.log(req.body);
	
	res.redirect('/notifications');
});

router.post('/subscribe', async function(req, res){
	
	console.log(req.body);
	
	res.redirect('/notifications');
});

module.exports = router;