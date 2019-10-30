const router = require('express').Router();
const logger = require('log4js').getLogger();
const webpush = require('web-push');
const utilities = require('../utilities');

router.get('/', async function(req, res){
	
	res.render('./notifications', {
		title: "Subscribing to a notification"
	});
});

router.post('/save-subscription', async function(req, res) {
	//check if user is logged in as a scouter
	if (!await req.authenticate(process.env.ACCESS_SCOUTER)) return;
	//check if it's a valid save request
	if (!await isValidSaveRequest(req, res)) {
		res.setHeader('Content-Type', 'application/json');
		return res.send({data: {success: false}});
	}
	
	const thisFuncName = 'notifications/save-subscription: ';
	
	logger.info(`${thisFuncName} Request to save push notification subscription for ${req.user.name}`);
	logger.debug(`${thisFuncName} body: ${JSON.stringify(req.body)}`);
	
	var pushSubscription = req.body;
	
	var writeResult = await utilities.update("users", {_id: req.user._id}, {$set: {push_subscription: pushSubscription}});
	
	logger.trace(`${thisFuncName} writeResult: ${JSON.stringify(writeResult)}`)
	
	//if user has been updated w/ push subscription, then send a success message
	if (writeResult.ok){
		
		logger.debug(`${thisFuncName} Success`)
		
		res.setHeader('Content-Type', 'application/json');
		res.send({data: {success: true}});
	}
	//if write result failed, then error out and send fail response
	else {
		logger.error(`${thisFuncName} The subscription was received but we were unable to save it to our database.`)
		
		res.status(500);
		res.setHeader('Content-Type', 'application/json');
		res.send({
			error: {
				id: 'unable-to-save-subscription',
				message: 'The subscription was received but we were unable to save it to our database.'
			}
		});
	}
});

router.post('/sendtest', async function(req, res){
	//check if user is logged in as a scouter
	if (!await req.authenticate(process.env.ACCESS_SCOUTER)) return;
	const thisFuncName = 'notifications/sendtest: ';
	
	const keys = await utilities.findOne('passwords', {name: 'web_push_keys'});	
	webpush.setVapidDetails('mailto:roboticsfundinc@gmail.com', keys.public_key, keys.private_key);
	
	const notificationBody = req.body.content != '' ? req.body.content : "Hello world!";
	
	const pushSubscription = req.user.push_subscription;
	
	if (pushSubscription){
		
		const notificationContent = JSON.stringify({
			title: "This is a test",
			options: {
				body: "hello!",
				badge: '/images/radio-badge.png',
				icon: '/images/icon-192.png',
				actions: [
					{
						action: 'coffee-action',
						title: 'Coffee',
						//icon: '',
					}
				]
			},
			ifFocused: {
				message: "Don't forget! This is a reminder!"
			},
		});
		// https://web-push-book.gauntface.com/demos/notification-examples/ 
		
		await sendPushMessage(pushSubscription, notificationContent);
		
	}
	else {
		logger.debug(`${thisFuncName} Push subscription not available for ${req.user.name}`);
	}
	
	res.redirect('/notifications');
});

async function sendPushMessage (subscription, dataToSend) {
	
	logger.debug(`Attempting to send push message: ${dataToSend}`);
	
	try {
		var result = await webpush.sendNotification(subscription, dataToSend);
		
		logger.debug(`Result: ${JSON.stringify(result)}`);
	}
	catch (err) {
		
		if (err.statusCode == 404 || err.statusCode == 410) {
			logger.warn(`Subscription has expired or is no longer valid: `, err);
		}
		
		logger.error(err);
	}
}

async function isValidSaveRequest (req, res) {
	
	// Check the request body has at least an endpoint
	if (!req.body || !req.body.endpoint) {
	  // Not a valid subscription.
	  res.status(400);
	  res.setHeader('Content-Type', 'application/json');
	  res.send(JSON.stringify({
		error: {
		  id: 'no-endpoint',
		  message: 'Subscription must have an endpoint.'
		}
	  }));
	  return false;
	}
	return true;
  };

module.exports = router;