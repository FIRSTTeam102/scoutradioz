'use strict';
class FormSubmission{
	
	data: Dictionary<any>;
	url: string;
	key: string;
	
	/**
	 * Generic form submission that uses NotificationCards.
	 * @param {HTMLFormElement|JQuery} form Form to submit
	 * @param {String} url POST URL to submit to
	 * @param {String} key Name of form (any)
	 */
	constructor(form: HTMLFormElement|JQuery, url: string, key: string){
		
		if (form && url && key) {
			this.data = this._getFormData(form);
			this.url = url;
			this.key = key; //Date.now().toString();
			
			this._addToLocalStorage();
		}
		else {
			throw new TypeError('FormSubmission: Form, URL and Key must be entered.');
		}
	}
	
	/**
	 * Submit the formsubmission.
	 * @param {ObjectCallback} cb Callback function. (err, message)
	 */
	submit(cb: ObjectCallback){
		
		var dataString = this._getFromLocalStorage();
		
		if(dataString){
			
			var data = JSON.parse(dataString);
			
			//Create a persistent notification card while the data is submitting.
			var cardSubmit = new NotificationCard('Submitting...', {ttl: 0}).show();
			
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
				.fail(() => {
					console.warn('failed');
				
					NotificationCard.show('Failed to send data. Attempting to re-submit...', {type: 'warn', ttl: 1000});
					setTimeout(() =>{
						this.submit(cb);
					}, 3000);
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
	
	_getFormData(form: HTMLFormElement|JQuery){
		var unIndexedData = $(form).serializeArray();
		var indexedData: Dictionary<string> = {};
	
		$.map(unIndexedData, function(n, i){
			indexedData[n.name] = n.value;
		});
		
		return indexedData;  
	}
}

interface ObjectCallback {
	(error: Error|string|null, response?: any): void;
}

interface Dictionary<T> {
    [Key: string]: T;
}