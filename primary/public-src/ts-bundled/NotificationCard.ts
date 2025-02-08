/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
'use strict';
// Notification cards.
//	Usage:
// 		NotificationCard.show("My text");
//		NotificationCard.show("This is an error!", {type: 'error'});
//		NotificationCard.warn("Watch out!");
//		NotificationCard.show("Click out of me!", {ttl: 0, exitable: true});
//		
//		var myCard = new NotificationCard("My text", {ttl: 0});
//		myCard.show();
//		myCard.remove();
//	Use the static methods 'show', 'good', 'warn', and 'bad' to quickly display a card with your message.
//	The aforementioned static methods will create a new card, which will automatically fade out a few seconds later.
//	To have greater control over your notification card, create one using the constructor: new NotificationCard(text, options)
//	Supported options:
//		type (String):
//			'good' or 'success': Card will be blue or green, meant to signify a success message.
//			'warn': Card will be amber, meant to signifiy a warning.
//			'bad' or 'error': Card will be red, meant to signify an error.
//			default: Card will be white or gray, meant to signify a standard message.
//		ttl (number): Time for card to live before it is faded and removed, in milliseconds. Default: 2000ms.
//		exitable (boolean): If true, the card will contain an X button, allowing the user to close the notification card. Default: false.
//		darken (boolean): If true, a semitransparent filter will appear over the document, blocking user input, 
//			until the card is removed. Default: false.
//  poke
class NotificationCard{
	
	text: string;
	opts: any;
	card: JQuery;
	_textContent: JQuery|undefined;
	darkener: JQuery|undefined;
	
	/**
	 * @param {string} text Text to display on notification card
	 * @param {object} [options] Optional settings
	 * @param {string} [options.type=undefined] Type of card to show (success, warn, error)
	 * @param {number} [options.ttl=2000] Time-to-live of notification card.
	 * @param {boolean} [options.darken=false] Whether card darkens/disabled entire screen when it is shown.
	 * @param {boolean} [options.exitable=false] Whether card has an exit button.
	 * @param {function} [options.onexit=undefined] Callback for when a user clicks the exit button.
	 */
	constructor(text: string, options?: NotificationCardOptions){
		
		if (!options) options = {};
		
		this.text = text;
		
		if (typeof text != 'string') {
			throw new TypeError('NotificationCard: text must be string.');
		}
		if (typeof options != 'object'){
			throw new TypeError('NotificationCard: opts must be object.');
		}
		
		this.opts = this._filterOptions(options);
		
		this.card = $();
	}
	
	/**
	 * Static method to create and return a new NotificationCard with specified options.
	 * @param {String} text Text to display on notification card
	 * @param {object} [options] Optional settings
	 * @param {string} [options.type=undefined] Type of card to show (success, warn, error)
	 * @param {number} [options.ttl=2000] Time-to-live of notification card.
	 * @param {boolean} [options.darken=false] Whether card darkens/disabled entire screen when it is shown.
	 * @param {boolean} [options.exitable=false] Whether card has an exit button.
	 * @param {function} [options.onexit=undefined] Callback for when a user clicks the exit button.
	 * @return {NotificationCard} The new NotificationCard object.
	 */
	static show(text: string, opts?: NotificationCardOptions|undefined){
		
		let newCard = new NotificationCard(text, opts);
		
		newCard.show();
		
		return newCard;
	}
	
	/**
	 * Shorthand to display an error/bad notification card.
	 * @param {string} text Text to display.
	 * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
	 */
	static error(text: string, opts?: NotificationCardOptions){
		
		if (!opts) opts = {};
		opts.type = 'error';
		
		return NotificationCard.show(text, opts);
	}
	
	/**
	 * Shorthand to display a good/success notification card.
	 * @param {string} text Text to display.
	 * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
	 */
	static good(text: string, opts?: NotificationCardOptions){
		
		if (!opts) opts = {};
		opts.type = 'good';
		
		return NotificationCard.show(text, opts);
	}
	
	/**
	 * Shorthand to display a warning notification card.
	 * @param {string} text Text to display.
	 * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
	 */
	static warn(text: string, opts?: NotificationCardOptions){
		
		if (!opts) opts = {};
		opts.type = 'warn';
		
		return NotificationCard.show(text, opts);
	}
	
	/**
	 * Gets and creates static container element for all notification cards.
	 * @return {JQuery} Parent element that contains all notification cards.
	 */
	static container(){
		
		let containerElement = $('#notificationcard-container');
		//If container element does not already exist, then create one with necessary properties
		if ( !containerElement[0] ){
			containerElement =  $(document.createElement('div'))
				.addClass('notification-card-container')
				.attr('id', 'notificationcard-container')
				.appendTo(document.body);
		}
		return containerElement;
	}
	
	/**
	 * Display the card.
	 */
	show(){
		//Create card element
		let card = $(document.createElement('div'))
			.addClass('notification-card')
			.css({
				'background-color': this.opts.color,
				'border-bottom-color': this.opts.borderColor,
				'color': this.opts.textColor,
			});
		
		//Enrich text with bold typefacing
		let enrichedText = this._enrichText();
		
		//Create text element
		let text = $(document.createElement('div'))
			.addClass('notification-card-content')
			.html(enrichedText.html());
		this._textContent = text;
		//Add exit button if exitable option is enabled
		if (this.opts.exitable) {
			//Create exit button
			let exitBtn = $(document.createElement('div'))
				.addClass('notification-card-exit')
				.css({})
				.text('X')
				.on('click', () => {
					//Onclick handler for exit button.
					this.remove();
					//Execute onexit callback
					if (this.opts.onexit) {
						this.opts.onexit();
					}
				});
			//Add exit button to card
			card.append(exitBtn);
		}
		//Add text to card
		card.append(text);
		//Add card to container element
		NotificationCard.container().append(card);
		//If screen-darken is enabled, then create darkener & add to container element
		if (this.opts.darken){
			this.darkener = $(document.createElement('div'))
				.addClass('canvas')
				.addClass('theme-darkener')
				.appendTo(NotificationCard.container());
		}
		
		this.card = card;		
		//If card has a nonzero time-to-live, then set timeout for fade-out
		if (this.opts.ttl != 0){
			setTimeout(() => {
				this.remove(1900);
			}, this.opts.ttl);
		}
		
		return this;
	}
	
	/**
	 * Change the text of the notification card.
	 * @param {string} newText New text to show.
	 */
	setText(newText: string) {
		this.text = newText;
		let enrichedText = this._enrichText();
		
		if (this._textContent) this._textContent.html(enrichedText.html());
	}
	
	/**
	 * Remove the card from the document.
	 * @param {Number} time (Optional) Fade-out card with given time interval. (Default: 0ms, no fade)
	 */
	remove(time?: number){
		
		let removeTime = 0;
		
		if (typeof time == 'number') {
			removeTime = time;
		}
		
		if (this.card) {
			$(this.card).css('opacity', 0);
			setTimeout(() => {
				this.card.remove();
				//remove screen darkener if applicable
				if (this.opts.darken && this.darkener) {
					$(this.darkener).remove();
				}
			}, removeTime);
		}
		
		return this;
	}
	
	_filterOptions(options: NotificationCardOptions){
		
		let defaultOpts = new NotificationCardOptions();
		
		// remove optional arguments that were explicitly stated as undefined or null, to allow for the spreading defaults to work
		for (let key in options) {
			if (key in options && options[key as keyof NotificationCardOptions] == undefined) {
				delete options[key as keyof NotificationCardOptions];
			}
		}
		
		let opts: NotificationCardOptions = {
			...defaultOpts,
			...options,
		};
		
		// for (let option in opts) {
			
		// 	if (options.hasOwnProperty(option)) {	
		// 		switch(option){
		// 			case 'type':
		// 				if (typeof options[option] == 'string') opts[option] = options[option];
		// 				else throw new TypeError('NotificationCard.opts.type must be string.');
		// 				break;
		// 			case 'ttl':
		// 				if (typeof options[option] == 'number') opts[option] = options[option];
		// 				else throw new TypeError('NotificationCard.opts.ttl must be a number.');
		// 				break;
		// 			case 'exitable':
		// 				if (typeof options[option] == 'boolean') opts[option] = options[option];
		// 				else throw new TypeError('NotificationCard.opts.exitable must be a boolean.');
		// 				break;
		// 			case 'darken':
		// 				if (typeof options[option] == 'boolean') opts[option] = options[option];
		// 				else throw new TypeError('NotificationCard.opts.darken must be a boolean.');
		// 				break;
		// 			case 'onexit':
		// 				if (typeof options[option] == 'function') opts[option] = options[option];
		// 				else throw new TypeError('NotificationCard.opts.onexit must be a function.');
		// 				break;
		// 			default:
		// 				throw new ReferenceError('NotificationCard.opts: Unknown option ' + option);
		// 		}
		// 	}
		// }
		
		//sort through type and set opts.color and opts.textColor
		switch (opts.type) {
			case 'good': 
			case 'success': 
				opts.color = 'rgb(91, 209, 255)';
				opts.borderColor = 'rgb(59, 102, 119)';
				opts.textColor = 'rgb(0,0,0)';
				break;
			case 'warn': 
				opts.color = 'rgb(230,170,10)';
				opts.borderColor = 'rgb(90,54,0)';
				opts.textColor = 'rgb(0,0,0)';
				break;
			case 'bad': 
			case 'error': 
				opts.color = 'rgb(160,20,10)';
				opts.borderColor = 'rgb(84,0,0)';
				opts.textColor = 'rgb(255,255,255)';
				break;
			default:
				opts.color ||= 'rgb(240,245,255)';
				opts.borderColor ||= 'rgb(80,80,84)';
				opts.textColor ||= 'rgb(0,0,0)';
		}
		
		return opts;
	}
	
	_enrichText(): JQuery {
		
		let text = this.text;
		
		//HTML-encode the text of the notificationcard (for safety)
		let enrichedText = $(document.createElement('span'))
			.text(text);
		
		//Enrich text with predetermined keys
		enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '*', '<b>', '</b>');
		enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '_', '<i>', '</i>');
		enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '\n', '</br>');
		enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '/n', '</br>');
		// 2025-01-24, M.O'C: Added hyperlink enrichment ~ reverse Markdown order i.e., (http://www.example.com)[link text]
		enrichedText = NotificationCard._enrichHyperlinkTags(enrichedText.html());
		
		if (this.opts.sprite) {
			enrichedText = 
			enrichedText.prepend(
				$(document.createElement('span'))
					.addClass('sprite sp-20 sp-inline sp-black sp-' + this.opts.sprite)
			);
		}

		return enrichedText;
	}
	
	static _enrichHyperlinkTags(html: string) {
		
		html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="link" target="_blank">$1</a>');
		
		//Create new span with the enriched html.
		let enrichedText = $(document.createElement('span'))
			.html(html);
		
		return enrichedText;
	}

	static _enrichWithClosingTags(html: string, key: string, openTag: string, closeTag: string) {
		
		//Get all locations of the key
		let locationsOfKey = [];
		for (let i = 0; i < html.length; i++) {
			if (html.substring(i, i + key.length) == key) {
				// escaped character
				if (html.substring(i-1, i) === '\\') {
					html = html.substring(0, i-1) + html.substring(i, html.length); // remove backslash
				}
				else {
					locationsOfKey.push(i);
				}
			}
		}
		
		let numIterations = 0;
		//Loop until there are no more pairs of the key
		while (locationsOfKey.length > 1) {
			
			//Add length of openTag/closeTag to indices so the indices don't get messed up
			let lengthAddition = numIterations * (openTag.length + closeTag.length - 2 * key.length);
			let thisIndex = locationsOfKey.splice(0, 1)[0] + lengthAddition;
			let nextIndex = locationsOfKey.splice(0, 1)[0] + lengthAddition;
			// var thisIndex = parseInt(locationsOfKey.splice(0, 1)) + lengthAddition;
			// var nextIndex = parseInt(locationsOfKey.splice(0, 1)) + lengthAddition;
			//Splice html together with opening and closing tags
			html = html.slice(0, thisIndex) + openTag + html.slice(thisIndex + key.length, nextIndex) + closeTag + html.slice(nextIndex + key.length);
						
			numIterations++;
		}
		
		//Create new span with the enriched html.
		let enrichedText = $(document.createElement('span'))
			.html(html);
		
		return enrichedText;
	}
	
	static _enrichWithSelfClosingTags(html: string, key: string, tag: string) {
		
		//Get all locations of the key
		let locationsOfKey = [];
		for (let i = 0; i < html.length; i++) {
			if (html.substring(i, i + key.length) == key) {
				// escaped character
				if (html.substring(i-1, i) === '\\') {
					html = html.substring(0, i-1) + html.substring(i, html.length); // remove backslash
				}
				else {
					locationsOfKey.push(i);
				}
			}
		}
		
		let numIterations = 0;
		//Loop until there are no more pairs of the key
		while (locationsOfKey.length > 0) {
			
			//Add length of tag to indices so the indices don't get messed up
			let lengthAddition = numIterations * (tag.length - key.length);
			let thisIndex = locationsOfKey.splice(0, 1)[0] + lengthAddition;
			
			//Splice html together with opening and closing tags
			html = html.slice(0, thisIndex) + tag + html.slice(thisIndex + key.length);
			
			numIterations++;
		}
		
		//Create new span with the enriched html.
		let enrichedText = $(document.createElement('span'))
			.html(html);
		
		return enrichedText;
	}
}

class NotificationCardOptions {
	sprite?: string;
	type?: string|undefined|null;
	ttl?: number|undefined|null;
	exitable?: boolean|undefined|null;
	darken?: boolean|undefined|null;
	onexit?: (() => void)|undefined|null;
	
	color?: string|undefined|null;
	borderColor?: string|undefined|null;
	textColor?: string|undefined|null;
	
	constructor() {
		this.type = 'normal';
		this.ttl = 2000;
		this.exitable = false;
		this.darken = false;
		this.onexit = null;
	}
}