type PromptItem = {
	type: 'password'|'label'|'textinput';
	/**
	 * Text value of a label, or placeholder value of a text/password input, or raw html value without any parsing
	 */
	value: string;
	default?: boolean;
}|HTMLElement;

type PromptReturnDatum = {
	type: 'password'|'textinput';
	value: string;
}

/**
 * Includes an array of the values of all input fields. 
 * 	e.g.: if contents[0] is a label, contents[1] is a textinput, contents[2] is a label, and contents[3] is a password,
 * 	then data will be [{type: 'textinput', value: string}, {type: 'password', value: string}]
 */
type PromptReturn = {
	cancelled: boolean;
	data: PromptReturnDatum[]
}

type PromptButton = {
	/**
	 * Text to show in the button
	 */
	label: string;
	/**
	 * Whether to highlight this button
	 */
	default: boolean;
	/**
	 * Action to execute when the button is clicked
	 */
	action: (this: Prompt) => void;
	timeout?: number;
}

type PromptOptions = {
	allowClickAway?: boolean;
}

class Prompt {
	animateDuration: number;
	card: JQuery;
	darkener: JQuery;
	contents: PromptItem[];
	elements: JQuery[];
	promise: Promise<PromptReturn>|undefined;
	buttons: PromptButton[];
	resolvePromise: ((...args: any[]) => void) | undefined;
	options: PromptOptions;
	
	constructor(contents: PromptItem[], buttons: PromptButton[], options?: PromptOptions) {
		this.animateDuration = 200;
		this.card = this.darkener = $();
		this.elements = [];
		this.contents = contents;
		this.buttons = buttons;
		// Options
		const defaultOptions: PromptOptions = {
			allowClickAway: true,
		};
		this.options = options || defaultOptions;
		this.options.allowClickAway ??= defaultOptions.allowClickAway;
	}
	
	static show(contents: PromptItem[], buttons: PromptButton[], options?: PromptOptions) {
		let newPrompt = new Prompt(contents, buttons, options);
		let promise = newPrompt.show();
		return promise;
	}
	
	show() {
		let card = $(document.createElement('div'))
			.addClass('prompt')
			.css('opacity', 0);
		let contentContainer = $(document.createElement('div'))
			.addClass('prompt-content w3-mobile w3-card')
			.appendTo(card);
			
		// Contents
		for (let i in this.contents) {
			let item = this.contents[i];
			let thisElement: JQuery;
			if (item instanceof HTMLElement) {
				thisElement = $(item).appendTo(contentContainer);
			}
			// PromptItem
			else {
				switch(item.type) {
					case 'label':
						thisElement = $(document.createElement('div'))
							.html(this._enrichText(item.value).html())
							.addClass('w3-margin-top')
							.appendTo(contentContainer);
						break;
					case 'textinput':
						thisElement = $(document.createElement('input'))
							.attr('type', 'textinput')
							.attr('placeholder', item.value)
							.addClass('w3-input w3-margin-top')
							// @ts-ignore (JQuery typing is dumb)
							.on('keydown', this.onKeyDown.bind(this))
							.appendTo(contentContainer);
						break;
					case 'password':
						thisElement = $(document.createElement('input'))
							.attr('type', 'password')
							.attr('placeholder', item.value)
							.addClass('w3-input w3-margin-top')
							// @ts-ignore (JQuery typing is dumb)
							.on('keydown', this.onKeyDown.bind(this))
							.appendTo(contentContainer);
						break;
				}
				if (item.default)
					setTimeout(() => thisElement.trigger('focus'), 1);
			}
			thisElement.attr('index', String(i)); // so it can be retrieved later
			this.elements.push(thisElement);
		}
		
		let btnParent = $(document.createElement('div'))
			.addClass('w3-right-align')
			.appendTo(contentContainer);
		
		// Buttons
		for (let button of this.buttons) {
			let thisBtnElement = $(document.createElement('button'))
				.addClass('w3-btn gear-btn')
				.text(button.label)
				.on('click', button.action.bind(this))
				.appendTo(btnParent);
			if (button.default)
				thisBtnElement.addClass('theme-submit');
			else
				thisBtnElement.addClass('theme-dim');
			if (button.timeout && button.timeout > 0) {
				// disable timeout
				thisBtnElement.attr('disabled', 1);
				setTimeout(() => {
					thisBtnElement.removeAttr('disabled');
				}, button.timeout);
			}
		}
		
		this.card = card;
		
		NotificationCard.container().append(card);
		// Borrow the NotificationCard container
		this.darkener = $(document.createElement('div'))
			.addClass('canvas')
			.addClass('theme-darkener')
			.css('opacity', 0)
			.appendTo(NotificationCard.container());
		// click-away
		if (this.options.allowClickAway)
			this.darkener.on('click', this.cancel.bind(this));
		
		// Fade in
		this.card.animate({opacity: 1}, this.animateDuration);
		this.darkener.animate({opacity: 1}, this.animateDuration);
		
		this.promise = new Promise((resolve) => {
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
	
	getData(): PromptReturnDatum[] {
		let ret: PromptReturnDatum[] = [];
		
		for (let i in this.contents) {
			let item = this.contents[i];
			if (item instanceof HTMLElement) continue; // skip raw HTMLElements
			if (item.type === 'password' || item.type === 'textinput') {
				let thisField = this.card.find(`input[index="${i}"]`);
				assert(thisField.length === 1, `Could not find field of index ${i}!`);
				ret.push({
					type: item.type,
					value: String(thisField.val())
				});
			}
		}
		return ret;
	}
	
	resolve() {
		if (this.resolvePromise) this.resolvePromise({cancelled: false, data: this.getData()});
		this.hide();
	}
	
	cancel() {
		if (this.resolvePromise) this.resolvePromise({cancelled: true, data: this.getData()});
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
	
	_enrichText(text: string): JQuery {
		
		//HTML-encode the text of the notificationcard (for safety)
		let enrichedText = $(document.createElement('span'))
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
	static show(text: string): Promise<{cancelled: boolean; password: string}> {
		assert(typeof text === 'string', 'PasswordPrompt: text must be string.');
		let promise = Prompt.show([
			{
				type: 'label',
				value: text,
				default: false
			}, {
				type: 'password',
				value: '',
				default: true
			}
		], twoPromptButtons('OK', 'Cancel'));
		return new Promise((resolve) => {
			promise.then((data) => {
				resolve({
					cancelled: data.cancelled,
					password: data.data[0].value
				});
			});
		});
	}
}

class Confirm {
	static show(text: string, options?: ConfirmOptions) {
		assert(typeof text === 'string', 'Confirm: text must be string.');
		
		const defaultOptions = {
			yesText: 'Yes',
			noText: 'No',
			yesTimeout: -1
		};
		options ??= defaultOptions;
		const yesText = options.yesText || defaultOptions.yesText;
		const noText = options.noText || defaultOptions.noText;
		const yesTimeout = options.yesTimeout || defaultOptions.yesTimeout;
		
		return Prompt.show([{
			type: 'label',
			value: text,
		}], 
		[{
			label: yesText,
			default: true,
			action: function () {
				this.resolve();
			},
			timeout: yesTimeout,
		}, {
			label: noText,
			default: false,
			action: function () {
				this.cancel();
			}
		}]);
	}
}

/**
 * Returns a set of PromptButtons for something like Yes/No, with the first one highlighted.
 */
function twoPromptButtons(text1: string, text2: string): PromptButton[] {
	return [{
		label: text1,
		default: true,
		action: function () {
			this.resolve();
		}
	}, {
		label: text2,
		default: false,
		action: function () {
			this.cancel();
		}
	}];
}

interface ConfirmOptions {
	yesText?: string;
	noText?: string;
	yesTimeout?: number;
}