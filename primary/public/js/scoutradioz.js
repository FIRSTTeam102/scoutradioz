/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
if(!$){
	console.error('scoutradioz.js error: jQuery not enabled');
}

$(() => {
	if (Cookies.get('accepted') != 'true') {
		var cookiesMessage = new NotificationCard('Scoutradioz uses cookies to operate. By using this website, you consent to the use of cookies.',
			{ttl: 0, exitable: true, onexit: function(){
				Cookies.set('accepted', 'true', {expires: 1000});
			}});
		cookiesMessage.show();
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