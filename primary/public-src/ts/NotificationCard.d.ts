
declare class NotificationCard{
	
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
	constructor(text: string, options?: object);
	
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
	static show(text: string, opts?: NotificationCardOptions|any): NotificationCard;
	
	/**
	 * Shorthand to display an error/bad notification card.
	 * @param {string} text Text to display.
	 * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
	 */
	static error(text: string, opts?: NotificationCardOptions|any): NotificationCard;
	
	/**
	 * Shorthand to display a good/success notification card.
	 * @param {string} text Text to display.
	 * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
	 */
	static good(text: string, opts?: NotificationCardOptions|any): NotificationCard;
	
	/**
	 * Shorthand to display a warning notification card.
	 * @param {string} text Text to display.
	 * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
	 */
	static warn(text: string, opts?: NotificationCardOptions|any): NotificationCard;
	
	/**
	 * Gets and creates static container element for all notification cards.
	 * @return {JQuery} Parent element that contains all notification cards.
	 */
	static container(): JQuery;
	
	/**
	 * Display the card.
	 */
	show(): NotificationCard;
	
	/**
	 * Change the text of the notification card.
	 * @param {string} newText New text to show.
	 */
	setText(newText: string): void;
	
	/**
	 * Remove the card from the document.
	 * @param {Number} time (Optional) Fade-out card with given time interval. (Default: 0ms, no fade)
	 */
	remove(time?: number): NotificationCard;
	
	_filterOptions(options: any): NotificationCardOptions;
	
	_enrichText(): JQuery;
	
	static _enrichWithClosingTags(html: string, key: string, openTag: string, closeTag: string): JQuery;
	
	static _enrichWithSelfClosingTags(html: string, key: string, tag: string): JQuery;
}

declare class NotificationCardOptions {
	type: string|undefined|null;
	ttl: number|undefined|null;
	exitable: boolean|undefined|null;
	darken: false|undefined|null;
	onexit: Function|undefined|null;
	
	color: string|undefined|null;
	borderColor: string|undefined|null;
	textColor: string|undefined|null;
}
