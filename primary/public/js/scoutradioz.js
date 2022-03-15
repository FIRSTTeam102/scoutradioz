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
	// JL TODO: Override Cookies.set() method to allow for a simple global cookie enable/disable switch?
	//		We can't disable Cookies.org_key, but we can disable non necessary ones like report columns and the selected "Are you:" button on the chooseorg page
	//		Possible text: "Before you reject the use of non-necessary cookies, please take a look at our cookie policy, where we explain what each is used for. We do not use third party cookies or tracking cookies."
	Cookies.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
});

(() => {
	
	
	const resizeCallbacks = [];
	
	/**
	 * Run a particular piece of code when the window resizes, but after waiting a few ms to reduce processor demand.
	 * @param {function} cb Callback to run on a resize event.
	 */
	window.onResize = function(cb) {
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
			var x = new Error();
			NotificationCard.error(
				`ERROR: ${message}\nPlease report as an issue on our GitHub page.\n\nCall stack: ${x.stack}`, 
				{exitable: true, ttl: 0}
			);
		}
	};
	
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
	
	window.debugToHTML = function(message) {
		
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
	};
})();

function scrollToId(id) {
	var elem = document.getElementById(id);
	if (elem) elem.scrollIntoView({behavior: 'smooth'});
	else console.error(`Element with id ${id} not found.`);
}

class Confirm {
	constructor(text, yesText, noText) {
		if (typeof text !== 'string') throw new TypeError('PasswordPrompt: text must be string.');
		if (!yesText) yesText = 'YES';
		if (!noText) noText = 'NO';
		this.text = text;
		this.yesText = yesText;
		this.noText = noText;
		this.animateDuration = 200;
	}
	
	static show(text, yesText, noText) {
		var newConfirm = new Confirm(text, yesText, noText);
		var promise = newConfirm.show();
		return promise;
	}
	
	show() {
		var card = $(document.createElement('div'))
			.addClass('password-prompt')
			.css('opacity', 0);
		var content = $(document.createElement('div'))
			.addClass('password-prompt-content w3-mobile w3-card')
			.appendTo(card);
		var text = $(document.createElement('div'))
			.html(this._enrichText())
			.addClass('w3-margin-top')
			.appendTo(content);
		var btnParent = $(document.createElement('div'))
			.addClass('w3-right-align')
			.appendTo(content);
		var yesBtn = $(document.createElement('button'))
			.addClass('w3-btn theme-submit gear-btn')
			.text(this.yesText)
			.on('click', this.resolve.bind(this))
			.appendTo(btnParent);
		var noBtn = $(document.createElement('button'))
			.addClass('w3-btn theme-submit gear-btn')
			.text(this.noText)
			.on('click', this.cancel.bind(this))
			.appendTo(btnParent);
			
		this.card = card;
		
		NotificationCard.container().append(card);
		// Borrow the NotificationCard container
		this.darkener = $(document.createElement('div'))
			.addClass('canvas')
			.addClass('theme-darkener')
			.css('opacity', 0)
			.appendTo(NotificationCard.container())
			.on('click', this.cancel.bind(this));
		
		// Fade in
		this.card.animate({opacity: 1}, this.animateDuration);
		this.darkener.animate({opacity: 1}, this.animateDuration);
		
		this.promise = new Promise((resolve, reject) => {
			this.resolvePromise = resolve;
		});
		return this.promise;
	}
	
	resolve() {
		this.resolvePromise({cancelled: false});
		this.hide();
	}
	
	cancel() {
		this.resolvePromise({cancelled: true});
		this.hide();
	}
	
	hide() {
		// fade out then remove
		this.darkener.animate({opacity: 0}, this.animateDuration);
		this.card.animate({opacity: 0}, {
			duration: this.animateDuration,
			complete: () => {
				this.card.remove();
				this.darkener.remove();
			}
		});
	}
	
	_enrichText() {
		var text = this.text;
		
		//HTML-encode the text of the notificationcard (for safety)
		var enrichedText = $(document.createElement('span'))
			.text(text);
		
		//Enrich text with predetermined keys
		enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '*', '<b>', '</b>');
		enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '_', '<i>', '</i>');
		enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '\n', '</br>');
		enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '/n', '</br>');
		
		return enrichedText;
	}
}

class PasswordPrompt {
	constructor(text) {
		if (typeof text !== 'string') throw new TypeError('PasswordPrompt: text must be string.');
		this.text = text;
		this.animateDuration = 200;
	}
	
	static show(text) {
		var newPrompt = new PasswordPrompt(text);
		var promise = newPrompt.show();
		return promise;
	}
	
	show() {
		var card = $(document.createElement('div'))
			.addClass('password-prompt')
			.css('opacity', 0);
		var content = $(document.createElement('div'))
			.addClass('password-prompt-content w3-mobile w3-card')
			.appendTo(card);
		var text = $(document.createElement('div'))
			.html(this._enrichText())
			.addClass('w3-margin-top')
			.appendTo(content);
		var passwordField = $(document.createElement('input'))
			.attr('type', 'password')
			.addClass('w3-input w3-margin-top')
			.on('keydown', this.onKeyDown.bind(this))
			.appendTo(content);
		var btnParent = $(document.createElement('div'))
			.addClass('w3-right-align')
			.appendTo(content);
		var okBtn = $(document.createElement('button'))
			.addClass('w3-btn theme-submit gear-btn')
			.text('OK')
			.on('click', this.resolve.bind(this))
			.appendTo(btnParent);
		var cancelBtn = $(document.createElement('button'))
			.addClass('w3-btn theme-submit gear-btn')
			.text('Cancel')
			.on('click', this.cancel.bind(this))
			.appendTo(btnParent);
			
		this.passwordField = passwordField;
		this.card = card;
		
		NotificationCard.container().append(card);
		// Borrow the NotificationCard container
		this.darkener = $(document.createElement('div'))
			.addClass('canvas')
			.addClass('theme-darkener')
			.css('opacity', 0)
			.appendTo(NotificationCard.container())
			.on('click', this.cancel.bind(this));
		
		// Fade in
		this.card.animate({opacity: 1}, this.animateDuration);
		this.darkener.animate({opacity: 1}, this.animateDuration);
		
		passwordField.focus();
		
		this.promise = new Promise((resolve, reject) => {
			this.resolvePromise = resolve;
		});
		return this.promise;
	}
	
	onKeyDown(e) {
		switch(e.key) {
			case 'Enter': this.resolve(); break;
			case 'Escape': this.cancel(); break;
		}
	}
	
	resolve() {
		this.resolvePromise({cancelled: false, password: this.passwordField.val()});
		this.hide();
	}
	
	cancel() {
		this.resolvePromise({cancelled: true});
		this.hide();
	}
	
	hide() {
		// fade out then remove
		this.darkener.animate({opacity: 0}, this.animateDuration);
		this.card.animate({opacity: 0}, {
			duration: this.animateDuration,
			complete: () => {
				this.card.remove();
				this.darkener.remove();
			}
		});
	}
	
	_enrichText() {
		var text = this.text;
		
		//HTML-encode the text of the notificationcard (for safety)
		var enrichedText = $(document.createElement('span'))
			.text(text);
		
		//Enrich text with predetermined keys
		enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '*', '<b>', '</b>');
		enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '_', '<i>', '</i>');
		enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '\n', '</br>');
		enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '/n', '</br>');
		
		return enrichedText;
	}
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