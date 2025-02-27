/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

if(!$){
	console.error('scoutradioz.js error: jQuery not enabled');
}

$(() => {
	// Check if news has been sent from the server, and if so, display it
	let newsUpdate = Cookies.get('news_update_to_display');
	if (newsUpdate) {
		let newsCard = new NotificationCard(newsUpdate, {
			color: '#ffffff',
			borderColor: '#ff8e24',
			textColor: '#33231d',
			sprite: 'info',
			exitable: true,
			ttl: 0,
			onexit: () => {
				// After user dismissed...
				// Clear the newsUpdate string so it stops getting displayed by client
				Cookies.remove('news_update_to_display');
				// and set cookie as acknowledgment to the server that this specific news item was read and dismissed
				Cookies.set('last_news_update_read', Cookies.get('news_update_id'));
			}
		});
		newsCard.show();
	}
	
	
	// if (Cookies.get('accepted') != 'true') {
	// 	let cookiesMessage = new NotificationCard('Scoutradioz uses some cookies in order to operate. We do not use third party cookies or tracking cookies.',
	// 		{ttl: 0, exitable: true, onexit: function(){
	// 			Cookies.set('accepted', 'true', {expires: 1000});
	// 		}});
	// 	// cookiesMessage.show();	2021-08-03 JL: Disabled cookie message because we probably don't need to show the message for the time being
	// }
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


declare function debugToHTML(message: any, replace?: boolean): void;
/**
 * Run a particular piece of code when the window resizes, but after waiting a few ms to reduce processor demand.
 * @param cb Callback to run on a resize event.
 */
declare function onResize(cb: () => void): void; 
(() => {
		
	const resizeCallbacks: Array<() => void> = [];
	
	window.onResize = function(cb: () => void) {
		resizeCallbacks.push(cb);
		requestAnimationFrame(cb); // Run the callback once
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
	
	let debugLogger = document.createElement('div');
	$(debugLogger).css({
		'background-color': 'white',
		'color': 'black',
		'z-index': '9999',
		'position': 'fixed',
		'line-height': '1',
		'top': '0',
		'right': '0',
		'width': '25%',
		'padding': '8px 16px',
	});
	
	window.debugToHTML = function(message: string, replace?: boolean) {
		
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
		$(newTextElem).text(text).css({'margin': '0.5em 0px'});
		
		if (replace === true) $(debugLogger).html('');
		$(debugLogger).append(newTextElem);
	};
})();
	
/**
 * Assert a condition & display an error message to the user.
 * @param condition Condition to test
 * @param message Message to display
 */
function assert(condition: unknown, message?: any): asserts condition {
	if (!condition) {
		let err = new Error();
		NotificationCard.error(
			`ERROR: ${message}\nPlease report as an issue on our GitHub page.\n\nCall stack: ${err.stack}`, 
			{exitable: true, ttl: 0}
		);
		throw err;
	}
}

/**
 * Assert a condition & display an error message to the user WITHOUT a call stack.
 * @param {boolean} condition Condition to test
 * @param {string} message Message to display
 */
function lightAssert(condition: unknown, message?: any): asserts condition {
	if (!condition) {
		let err = new Error();
		NotificationCard.error(
			`ERROR: ${message}`,
			{exitable: true, ttl: 0}
		);
		throw err;
	}
}

function scrollToId(id: string) {
	let elem = document.getElementById(id);
	if (elem) elem.scrollIntoView({behavior: 'smooth'});
	else console.error(`Element with id ${id} not found.`);
}

async function share(orgKey: string|boolean) {
	
	let origin = window.location.origin;
	let pathname = window.location.pathname;
	let search = window.location.search;
	
	//if orgKey is defined, add it to the base of the pathname
	if (orgKey != false) {
		pathname = '/' + orgKey + pathname;
	}
	
	let shareURL = origin + pathname + search;
	
	console.log(shareURL);
	
	// First, attempt to use the browser's native Share functionality
	if ('share' in navigator && 'canShare' in navigator) {
		let shareData = {
			url: shareURL,
			title: document.title,
		};
		console.log(`Attempting to share: ${JSON.stringify(shareData)}`);
		
		if (navigator.canShare(shareData)) {
			try {
				navigator.share(shareData);
				console.log('Shared data');
				return; // exit so we don't copy the link to the clipboard later
			}
			catch (err) {
				console.log('Error sharing data:', err);
			}
		}
	}
	
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

function selectLanguage() {
	lightAssert(locales, 'List of languages not found.');
	
	let promptItems: PromptItem[] = [];
	
	let prompt: Prompt;
	let currentLang = document.documentElement.lang || 'en';
	let langNames = new Intl.DisplayNames([currentLang], {type: 'language'});
	
	// Create a list of clickable items for each language we have
	locales.forEach((locale, idx) => {
		let newElem = document.createElement('div');
		newElem.classList.add('w3-padding', 'w3-border-bottom', 'clickable', 'flex');
		if (idx === 0) newElem.classList.add('w3-margin-top'); // top element
		newElem.innerHTML = `${langNames.of(locale.lang)} (${locale.name})`;
		newElem.onclick = () => {
			// On click, hide the promot and set the new language
			if (prompt) {
				prompt.hide();
			}
			Cookies.set('language', locale.lang);
			location.reload();
		};
		promptItems.push(newElem);
	});
	
	prompt = new Prompt(promptItems, [{
		label: 'Cancel',
		action: () => {
			prompt.cancel();
		},
		default: true,
	}]);
	
	prompt.show();
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
	
/**
 * Measure the time interval to execute the callback function.
 * @param cb Function to run
 */
function measureTime(cb: () => void) : number {
	let st = performance.now();
	cb();
	return performance.now() - st;
}

declare class Cookies {
	static get(key: string): string;
	static set(key: string, value: string, value2?: any): string;
	static remove(key: string): void;
}