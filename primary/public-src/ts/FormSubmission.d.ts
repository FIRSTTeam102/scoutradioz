
declare class FormSubmission{
	
	data: Dictionary<any>;
	url: string;
	key: string;
	/**
	 * Generic form submission that uses NotificationCards.
	 * @param {HTMLFormElement|JQuery} form Form to submit
	 * @param {String} url POST URL to submit to
	 * @param {String} key Name of form (any)
	 */
	constructor(form: HTMLFormElement|JQuery, url: string, key: string);
	
	/**
	 * Submit the formsubmission.
	 * @param {ObjectCallback} cb Callback function. (err, message)
	 */
	submit(cb: ObjectCallback): void;
	
	_getFromLocalStorage(): string;
	
	_addToLocalStorage(): void;
	
	_getFormData(form: HTMLFormElement|JQuery): Dictionary<String>;
}

interface ObjectCallback {
	(error: Error|string|null, response?: any): void;
}

interface Dictionary<T> {
    [Key: string]: T;
}