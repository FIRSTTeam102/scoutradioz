if(!$){
	console.error("scoutradioz.js error: jQuery not enabled");
}

var debugLogger = document.createElement("div");
$(debugLogger).css({
	"background-color": "white",
	"color": "black",
	"z-index": "99",
	"position": "absolute",
	"top": "0",
	"width": "25%",
	"padding": "8px 16px",
});

function debugToHTML(message) {
	
	var text;
	
	switch (typeof message) {
		case "string":
		case "number":
			text = message;
			break;
		case "object":
		case "array":
			text = JSON.stringify(message);
			break;
		default:
			text = message;
	}
	
	//if logger is not already added to document.body, add it now
	if ( !$(debugLogger).parent()[0] ) {
		
		$(document.body).append(debugLogger);
	}
	
	var newTextElem = document.createElement("pre");
	$(newTextElem).text(text);
	
	$(debugLogger).append(newTextElem);
}


var containerElement;

class NotificationCard{
	
	/*
	static containerElement;
	card;
	text;
	opts;
	onclose = null;
	onfadeend = null;
	onfadebegin = null;
	*/

	/**
	 * @param {String} text Text to display on notification card
	 * @param {Object} options Options
	 */
	constructor(text, options){
		
		if (!options) options = {};
		
		this.text = text;
		
		if (typeof text != "string") {
			throw new TypeError("NotificationCard: text must be string.");
		}
		if (typeof options != "object"){
			throw new TypeError("NotificationCard: opts must be object.");
		}
		
		this.opts = this.filterOptions(options)
		
	}
	
	/**
	 * Static method to create and return a new NotificationCard with specified options.
	 * @param {String} text Text to display on notification card
	 * @param {Object} opts (optional) Options
	 * @return {NotificationCard} The new NotificationCard object.
	 */
	static show(text, opts){
		
		var newCard = new NotificationCard(text, opts);
		
		newCard.show();
		
		return newCard;
	}
	
	/**
	 * Shorthand to display an error/bad notification card.
	 * @param {string} text Text to display.
	 */
	static error(text){
		
		return NotificationCard.show(text, {type: "error"});
	}
	
	/**
	 * Shorthand to display a good/success notification card.
	 * @param {string} text Text to display.
	 */
	static good(text){
		
		return NotificationCard.show(text, {type: "good"});
	}
	
	/**
	 * Shorthand to display a warning notification card.
	 * @param {string} text Text to display.
	 */
	static warn(text){
		
		return NotificationCard.show(text, {type: "warn"});
	}
	
	/**
	 * Gets and creates static container element for all notification cards.
	 */
	static container(){
		
		if (!containerElement){
			containerElement =  $(document.createElement("div"))
			.addClass("notification-card-container")
			.appendTo(document.body);
		}
		return containerElement;
	}
	
	show(){
		
		var card = $(document.createElement("div"))
			.addClass("notification-card")
			.css({
				"background-color": this.opts.color,
				"border-bottom-color": this.opts.borderColor,
				"color": this.opts.textColor,
			});
		var text = $(document.createElement("div"))
			.addClass("notification-card-content")
			.text(this.text);
			
		var exitBtn = $(document.createElement("div"))
			.addClass("exit");
			
		card.append(text);
		//text.append(exitBtn);
		
		NotificationCard.container().append(card);
		
		if (this.opts.darken){
			var darkener = document.createElement("div");
			$(darkener).addClass("canvas").addClass("theme-darkener");
			$(NotificationCard.containerElement).append(darkener);
		}

		
		this.card = card;
		
		//console.log(this.opts);
		//console.log("TTL " + this.opts.ttl);
		
		
		if (this.opts.ttl != 0){
			setTimeout(() => {
				this.remove();
			}, this.opts.ttl);
		}
		
		
		return this;
	}
	
	/**
	 * 
	 * @param {Number} time (Optional) Time to remove card (Set to 0 to remove immediately; default 1900ms)
	 */
	remove(time){
		
		var removeTime = 1900;
		
		if (typeof time == "number") {
			removeTime = time;
		}
		
		if (this.card) {
			$(this.card).css("opacity", 0);
			setTimeout(() => {
				$(this.card).remove();
			}, removeTime);
		}
		
		return this;
	}
	
	filterOptions(options){
		
		var defaultOpts = {
			type: "normal",
			ttl: 2000,
			exitable: false,
			darken: false,
		}
		
		var opts = defaultOpts;
		
		for (var option in opts) {
			
			if (options.hasOwnProperty(option)) {	
				switch(option){
					case "type":
						if (typeof options[option] == 'string') opts[option] = options[option];
						else throw new TypeError("NotificationCard.opts.type must be string.")
						break;
					case "ttl":
						if (typeof options[option] == 'number') opts[option] = options[option];
						else throw new TypeError("NotificationCard.opts.ttl must be a number.")
						break;
					case "exitable":
						if (typeof options[option] == 'boolean') opts[option] = options[option];
						else throw new TypeError("NotificationCard.opts.exitable must be a boolean.")
						break;
					case "darken":
						if (typeof options[option] == 'boolean') opts[option] = options[option];
						else throw new TypeError("NotificationCard.opts.darken must be a boolean.");
						break;
					default:
						throw new ReferenceError("NotificationCard.opts: Unknown option " + option);
				}
			}
		}
		//console.log(opts.type);
		//sort through type and set opts.color and opts.textColor
		switch (opts.type) {
			case "good": 
			case "success": 
				opts.color = "rgb(91, 209, 255)";
				opts.borderColor = "rgb(59, 102, 119)";
				opts.textColor = "rgb(0,0,0)";
				break;
			case "warn": 
				opts.color = "rgb(230,170,10)";
				opts.borderColor = "rgb(90,54,0)";
				opts.textColor = "rgb(0,0,0)";
				break;
			case "bad": 
			case "error": 
				opts.color = "rgb(160,20,10)";
				opts.borderColor = "rgb(84,0,0)";
				opts.textColor = "rgb(255,255,255)";
				break;
			default: 
				opts.color = "rgb(240,245,255)";
				opts.borderColor = "rgb(50,50,50)";
				opts.textColor = "rgb(0,0,0)";
		}
		
		return opts;
	}
}

class FormSubmission{
	
	/**
	 * Submission of a form.
	 * @param {HTMLFormElement} form Form to submit
	 * @param {String} url POST URL to submit to
	 * @param {String} key Name of form (any)
	 */
	constructor(form, url, key){
		
		if (form && url && key) {
			this.data = this._getFormData(form);
			this.url = url;
			this.key = key; //Date.now().toString();
			
			this._addToLocalStorage();
		}
		else {
			throw new TypeError("FormSubmission: Form, URL and Key must be entered.")
		}
	}
	
	/**
	 * Submit the formsubmission.
	 * @param {Function} cb Callback function. (err, message)
	 */
	submit(cb){
		
		var dataString = this._getFromLocalStorage();
		
		if(dataString){
			
			var data = JSON.parse(dataString);
			
			//Create a persistent notification card while the data is submitting.
			var cardSubmit = new NotificationCard("Submitting...", {ttl: 0}).show();
			
			console.log(`Submitting to url: ${this.url}`);
			console.log(`data:`);
			console.log(data);
			
			$.post(this.url, data)
			.always(() => {
				
				//Remove submission notification card
				cardSubmit.remove(0);
			})
			.done((response) => {
				
				cb(null, response.message);
			})
			.fail(() => {
				console.warn("failed");
				
				NotificationCard.show("Failed to send data. Attempting to re-submit...", {type: "warn", ttl: 1000});
				setTimeout(() =>{
					this.submit(cb);
				}, 3000);
			});
			
		}
		//if data isn't found
		else{
			cb("Failed to retrieve data from LocalStorage")
		}
	}
	
	_getFromLocalStorage(){
		return localStorage.getItem(this.key);
	}
	
	_addToLocalStorage(){
		localStorage.setItem(this.key, JSON.stringify(this.data));
	}
	
	_getFormData(form){
		var unIndexedData = $(form).serializeArray();
		var indexedData = {};
	
		$.map(unIndexedData, function(n, i){
			indexedData[n['name']] = n['value'];
		});
		
		return indexedData;
	}
}