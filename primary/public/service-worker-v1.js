/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// https://developers.google.com/web/fundamentals/push-notifications/display-a-notification
self.addEventListener('push', function(event) {
	if (event.data) {
		console.log('This push event has data: ', event.data.text());
	}
	else {
		console.log('This push event has no data.');
	}
	const messageJSON = event.data.json();
	
	const promiseChain = isClientFocused()
		.then((clientIsFocused) => {
		
			// Client isn't focused, we need to show a notification.
			return self.registration.showNotification(messageJSON.title, messageJSON.options)
				.then(() => {
					if (clientIsFocused) {
						console.log('Don\'t need to show a notification.');
				
						//Post message to client window
						return postMessageToClient(messageJSON);
					}
				});
		});
	
	event.waitUntil(promiseChain);
});

// https://stackoverflow.com/questions/30302636/clients-openwindow-not-allowed-to-open-a-window-on-a-serviceworker-google-c
self.addEventListener('notificationclick', function (event) {
	event.notification.close();
	console.log(clients);
	// Open a window after a little bit of time
	var promise = new Promise(function(resolve) {
		setTimeout(resolve, 100);
	}).then(function() {
		// Only open a window if it's a proper url
		if (event.action && !event.action.endsWith('.js')) {
			return clients.openWindow(event.action);
		}
		else {
			// If the action ends with JS, that means the general notification was clicked; so let's bring one of the client windows into focus
			return clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			})
				.then((windowClients) => {
					// Identify if any are focused or visible
					var focusedClient, visibleClient;
					windowClients.forEach((windowClient) => {
						if (windowClient.focused) focusedClient = windowClient;
						if (windowClient.visibilityState === 'visible') visibleClient = windowClient;
					});
					console.log('Focused client: ', focusedClient);
					console.log('Visible client: ', visibleClient);
					if (!focusedClient) {
						if (visibleClient) visibleClient.focus();
						else windowClients[0].focus();
					}
				});
		}
	});

	// Now wait for the promise to keep the permission alive.
	event.waitUntil(promise);
});

function postMessageToClient(message){
	return clients.matchAll({
		type: 'window',
		includeUncontrolled: true
	})
		.then((windowClients) => {
			windowClients.forEach((windowClient) => {
				windowClient.postMessage(message);
			});
		});
}

function isClientFocused() {
	return clients.matchAll({
		type: 'window',
		includeUncontrolled: true
	})
		.then((windowClients) => {
			let clientIsFocused = false;
	
			for (let i = 0; i < windowClients.length; i++) {
				const windowClient = windowClients[i];
				if (windowClient.focused) {
					clientIsFocused = true;
					break;
				}
			}
	
			return clientIsFocused;
		});
}