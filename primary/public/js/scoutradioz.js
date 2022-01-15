/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
if(!$){
	console.error('scoutradioz.js error: jQuery not enabled');
}

$(() => {
	if (Cookies.get('accepted') != 'true') {
		var cookiesMessage = new NotificationCard('Scoutradioz uses some cookies in order to operate. We do not use third party cookies or tracking cookies.',
			{ttl: 0, exitable: true, onexit: function(){
				Cookies.set('accepted', 'true', {expires: 1000});
			}});
		// cookiesMessage.show();	2021-08-03 JL: Disabled cookie message because we probably don't need to show the message for the time being
	}
});

var debugLogger = document.createElement('div');
$(debugLogger).css({
	'background-color': 'white',
	'color': 'black',
	'z-index': '99',
	'position': 'absolute',
	'top': '0',
	'width': '25%',
	'padding': '8px 16px',
});

function debugToHTML(message) {
	
	var text;
	
	switch (typeof message) {
		case 'string':
		case 'number':
			text = message;
			break;
		case 'object':
		case 'array':
			text = JSON.stringify(message);
			break;
		default:
			text = message;
	}
	
	//if logger is not already added to document.body, add it now
	if ( !$(debugLogger).parent()[0] ) {
		
		$(document.body).append(debugLogger);
	}
	
	var newTextElem = document.createElement('pre');
	$(newTextElem).text(text);
	
	$(debugLogger).append(newTextElem);
}

function share(orgKey) {
	
	var origin = window.location.origin;
	var pathname = window.location.pathname;
	var search = window.location.search;
	
	//if orgKey is defined, add it to the base of the pathname
	if (orgKey != false) {
		pathname = '/' + orgKey + pathname;
	}
	
	var shareURL = origin + pathname + search;
	
	console.log(shareURL);
	
	// Attempt to use navigator.clipboard.writeText
	if (navigator.clipboard && navigator.clipboard.writeText) {
		
		console.log('Attempting navigator.clipboard.writeText');
		
		navigator.clipboard.writeText(shareURL)
			.then(() => {
				NotificationCard.good('Copied link to clipboard. Share it in an app.');
			})
			.catch(err => {
				//Fallback to DOM copy
				console.log(err);
				copyClipboardDom(shareURL);
			});
	}
	else {
		//Fallback to DOM copy
		console.log('navigator.clipboard.writeText does not exist; falling back to DOM copy');
		copyClipboardDom(shareURL);
	}
}

function copyClipboardDom(text) {
	try {
		
		console.log('Attempting DOM copy');
		
		var shareURLInput = $('#shareURLInput');
		shareURLInput.attr('value', text);
		shareURLInput[0].select();
		shareURLInput[0].setSelectionRange(0, 99999); 
		document.execCommand('copy');
		
		NotificationCard.good('Copied link to clipboard. Share it in an app.');
	}
	catch (err) {
		console.error(err);
		NotificationCard.bad(`Could not copy to clipboard. Error: ${err.message}`);
	}
}