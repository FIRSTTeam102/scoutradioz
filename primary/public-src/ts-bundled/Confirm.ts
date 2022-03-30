
class Confirm {
	
	text: string;
	yesText: string;
	noText: string;
	animateDuration: number;
	yesTimeout: number; // Time, in ms, before allowing the user to click "yes"
	card: JQuery;
	darkener: JQuery;
	promise: Promise<{cancelled: boolean}> | undefined;
	resolvePromise: Function | undefined;
	
	constructor(text: string, options?: ConfirmOptions) {
		if (!options) options = {};
		if (typeof text !== 'string') throw new TypeError('PasswordPrompt: text must be string.');
		if (!options.yesText) options.yesText = 'YES';
		if (!options.noText) options.noText = 'NO';
		if (!options.yesTimeout) options.yesTimeout = -1;
		this.text = text;
		this.yesText = options.yesText;
		this.noText = options.noText;
		this.yesTimeout = options.yesTimeout;
		this.animateDuration = 200;
		this.card = $();
		this.darkener = $();
	}
	
	static show(text: string, options?: ConfirmOptions) {
		var newConfirm = new Confirm(text, options);
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
			.html(this._enrichText().html())
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
		
		// If there is a yesTimeout, then disable the yes button for the duration
		if (this.yesTimeout > 0) {
			yesBtn.attr('disabled', 1);
			setTimeout(() => {
				yesBtn.removeAttr('disabled');
			}, this.yesTimeout);
		}
		
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
		if (this.resolvePromise) this.resolvePromise({cancelled: false});
		this.hide();
	}
	
	cancel() {
		if (this.resolvePromise) this.resolvePromise({cancelled: true});
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

declare class ConfirmOptions {
	yesText?: string;
	noText?: string;
	yesTimeout?: number;
}