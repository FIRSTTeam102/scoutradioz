
if(!$){
	console.error('scoutradioz.js error: jQuery not enabled');
}

$(() => {
	if (Cookies.get('accepted') != 'true') {
		let cookiesMessage = new NotificationCard('Scoutradioz uses some cookies in order to operate. We do not use third party cookies or tracking cookies.',
			{ttl: 0, exitable: true, onexit: function(){
				Cookies.set('accepted', 'true', {expires: 1000});
			}});
		// cookiesMessage.show();	2021-08-03 JL: Disabled cookie message because we probably don't need to show the message for the time being
	}
	// JL TODO: Override Cookies.set() method to allow for a simple global cookie enable/disable switch?
	//		We can't disable Cookies.org_key, but we can disable non necessary ones like report columns and the selected "Are you:" button on the chooseorg page
	//		Possible text: "Before you reject the use of non-necessary cookies, please take a look at our cookie policy, where we explain what each is used for. We do not use third party cookies or tracking cookies."
	Cookies.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
	
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', function(event) {
			console.log('Received a message from service worker: ', event.data);

			let message = event.data.ifFocused.message;
			NotificationCard.show(message, {ttl: 3500});
		});
	}
});

(() => {
	
	
	const resizeCallbacks: Array<() => void> = [];
	
	/**
	 * Run a particular piece of code when the window resizes, but after waiting a few ms to reduce processor demand.
	 * @param cb Callback to run on a resize event.
	 */
	window.onResize = function(cb: () => void) {
		resizeCallbacks.push(cb);
		cb(); // Run the callback once
	};
	
	let ticking = false;
	$(window).on('resize', () => {
		if (resizeCallbacks.length > 0) {
			if (!ticking) {
				ticking = true;
				setTimeout(() => {
					requestAnimationFrame(() => {
						for (let cb of resizeCallbacks) {
							cb();
						}
						ticking = false;
					});
				}, 50);
			}
		}
	});
	
	/**
	 * Assert a condition & display an error message to the user.
	 * @param {boolean} condition Condition
	 * @param {string} message Message to display
	 */
	window.assert = function (condition, message) {
		if (!condition) {
			let x = new Error();
			NotificationCard.error(
				`ERROR: ${message}\nPlease report as an issue on our GitHub page.\n\nCall stack: ${x.stack}`, 
				{exitable: true, ttl: 0}
			);
		}
	};
	
	let debugLogger = document.createElement('div');
	$(debugLogger).css({
		'background-color': 'white',
		'color': 'black',
		'z-index': '99',
		'position': 'absolute',
		'top': '0',
		'width': '25%',
		'padding': '8px 16px',
	});
	
	/**
	 * Measure the time interval to execute the callback function.
	 * @param cb Function to run
	 */
	window.measureTime = function(cb: () => void) {
		let st = performance.now();
		cb();
		return performance.now() - st;
	};
	
	window.debugToHTML = function(message: string) {
		
		let text;
		
		switch (typeof message) {
			case 'string':
			case 'number':
				text = message;
				break;
			case 'object':
				text = JSON.stringify(message);
				break;
			default:
				text = message;
		}
		
		//if logger is not already added to document.body, add it now
		if ( !$(debugLogger).parent()[0] ) {
			
			$(document.body).append(debugLogger);
		}
		
		let newTextElem = document.createElement('pre');
		$(newTextElem).text(text);
		
		$(debugLogger).append(newTextElem);
	};
})();

function scrollToId(id: string) {
	let elem = document.getElementById(id);
	if (elem) elem.scrollIntoView({behavior: 'smooth'});
	else console.error(`Element with id ${id} not found.`);
}

function share(orgKey: string|boolean) {
	
	let origin = window.location.origin;
	let pathname = window.location.pathname;
	let search = window.location.search;
	
	//if orgKey is defined, add it to the base of the pathname
	if (orgKey != false) {
		pathname = '/' + orgKey + pathname;
	}
	
	let shareURL = origin + pathname + search;
	
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

function copyClipboardDom(text: string) {
	try {
		
		console.log('Attempting DOM copy');
		
		let shareURLInput: JQuery<HTMLInputElement> = $('#shareURLInput');
		shareURLInput.attr('value', text);
		shareURLInput[0].select();
		shareURLInput[0].setSelectionRange(0, 99999); 
		document.execCommand('copy');
		
		NotificationCard.good('Copied link to clipboard. Share it in an app.');
	}
	catch (err: any) {
		console.error(err);
		NotificationCard.error(`Could not copy to clipboard. Error: ${err.message}`);
	}
}

declare class Cookies {
	static get(key: string): any;
	static set(key: string, value: any, value2?: any): any;
	static remove(key: string): void;
}

declare function measureTime(cb: () => void) : number;
declare function debugToHTML(message: any): void;
declare function assert(condition: boolean, message: any): void;
declare function onResize(cb: () => void): void; 