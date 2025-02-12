'use strict';
class FormSubmission{
	/**
	 * JL note 2022-04-03: Since all uses of FormSubmission follow the following response system:
	 * 	{
	 * 		status: number,
	 * 		message: string
	 * 	}
	 * and it is convenient to keep the usage consistent across all usage of FormSubmissions, it should now be enforced.
	 * In the routes, do res.send({status: <number>, message: <string>}) for anything that uses a FormSubmission.
	 * 	Use 200 for success statuses.
	 */
	
	data: Dictionary<any>;
	url: string;
	key: string;
	options: {
		autoRetry: boolean;
	};
	
	/**
	 * Generic form submission that uses NotificationCards.
	 * @param {HTMLFormElement|JQuery} form Form to submit
	 * @param {String} url POST URL to submit to
	 * @param {String} key Name of form (any)
	 * @param {object} [options]
	 * @param {boolean} [options.autoRetry=true] Whether to auto retry.
	 */
	constructor(form: HTMLFormElement|JQuery, url: string, key: string, options?: {autoRetry: boolean}){
		
		if (form && url && key) {
			this.data = FormSubmission.getFormData(form);
			this.url = url;
			this.key = key; //Date.now().toString();
			
			if (!options) options = {
				autoRetry: true
			};
			if (typeof options.autoRetry !== 'boolean') options.autoRetry = true;
			this.options = options;
			
			this._addToLocalStorage();
		}
		else {
			throw new TypeError('FormSubmission: Form, URL and Key must be entered.');
		}
	}
	
	/**
	 * Submit the formsubmission.
	 * @param {ObjectCallback} cb Callback function. (err, response)
	 */
	submit(cb: ObjectCallback){
		
		
		let dataString = this._getFromLocalStorage();
		
		if(dataString){
			
			let data = JSON.parse(dataString);
			
			//Create a persistent notification card while the data is submitting.
			let cardSubmit = new NotificationCard('Submitting...', {ttl: 0}).show();
			
			console.log(`Submitting to url: ${this.url}`);
			console.log('data:');
			console.log(data);
			
			$.post(this.url, data)
				.always(() => {
				
					//Remove submission notification card
					cardSubmit.remove(0);
				})
				.done((response) => {
				
					cb(null, response);
				})
				.fail((response) => {
					// JL: Forward server-side errors with messages
					if (response.responseJSON && response.responseJSON.message) {
						return cb(response.responseJSON.message);
					}
					
					if (this.options.autoRetry) {
						NotificationCard.show('Failed to send data. Attempting to re-submit...', {type: 'warn', ttl: 1000});
						setTimeout(() =>{
							this.submit(cb);
						}, 3000);
					}
					else {
						cb(response);
					}
				});
		}
		//if data isn't found
		else{
			cb('Failed to retrieve data from LocalStorage');
		}
	}
	
	_getFromLocalStorage(){
		return localStorage.getItem(this.key);
	}
	
	_addToLocalStorage(){
		localStorage.setItem(this.key, JSON.stringify(this.data));
	}
	
	/**
	 * Get a key-value object from any form element (useful outside of the FormSubmission class)
	 */
	static getFormData(form: HTMLFormElement|JQuery) {
		let unIndexedData = $(form).serializeArray();
		let indexedData: Dictionary<string> = {};
	
		$.map(unIndexedData, function(n, i){
			indexedData[n.name] = n.value;
		});
		
		return indexedData;  
	}
}

interface ObjectCallback {
	(error: JQueryXHR|Error|string|null, response?: SRResponse): void;
}

declare class SRResponse {
	status: number;
	message: string;
}

interface Dictionary<T> {
    [Key: string]: T;
}