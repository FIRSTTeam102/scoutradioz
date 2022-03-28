
class PasswordPrompt {
	
	text: string;
	animateDuration: number;
	card: JQuery;
	darkener: JQuery;
	passwordField: JQuery;
	promise: Promise<{cancelled: boolean}> | undefined;
	resolvePromise: Function | undefined;
	
	constructor(text: string) {
		if (typeof text !== 'string') throw new TypeError('PasswordPrompt: text must be string.');
		this.text = text;
		this.animateDuration = 200;
		this.card = $();
		this.darkener = $();
		this.passwordField = $();
	}
	
	static show(text: string) {
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
			.html(this._enrichText().html())
			.addClass('w3-margin-top')
			.appendTo(content);
		var passwordField = $(document.createElement('input'))
			.attr('type', 'password')
			.addClass('w3-input w3-margin-top')
			// @ts-ignore (JQuery typing is dumb)
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
	
	onKeyDown(e: KeyboardEvent) {
		switch(e.key) {
			case 'Enter': this.resolve(); break;
			case 'Escape': this.cancel(); break;
		}
	}
	
	resolve() {
		if (this.resolvePromise) this.resolvePromise({cancelled: false, password: this.passwordField.val()});
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