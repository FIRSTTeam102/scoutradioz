'use strict';
class FormSubmission {
    constructor(form, url, key) {
        if (form && url && key) {
            this.data = this._getFormData(form);
            this.url = url;
            this.key = key;
            this._addToLocalStorage();
        }
        else {
            throw new TypeError('FormSubmission: Form, URL and Key must be entered.');
        }
    }
    submit(cb) {
        var dataString = this._getFromLocalStorage();
        if (dataString) {
            var data = JSON.parse(dataString);
            var cardSubmit = new NotificationCard('Submitting...', { ttl: 0 }).show();
            console.log(`Submitting to url: ${this.url}`);
            console.log('data:');
            console.log(data);
            $.post(this.url, data)
                .always(() => {
                cardSubmit.remove(0);
            })
                .done((response) => {
                cb(null, response.message);
            })
                .fail(() => {
                console.warn('failed');
                NotificationCard.show('Failed to send data. Attempting to re-submit...', { type: 'warn', ttl: 1000 });
                setTimeout(() => {
                    this.submit(cb);
                }, 3000);
            });
        }
        else {
            cb('Failed to retrieve data from LocalStorage');
        }
    }
    _getFromLocalStorage() {
        return localStorage.getItem(this.key);
    }
    _addToLocalStorage() {
        localStorage.setItem(this.key, JSON.stringify(this.data));
    }
    _getFormData(form) {
        var unIndexedData = $(form).serializeArray();
        var indexedData = {};
        $.map(unIndexedData, function (n, i) {
            indexedData[n.name] = n.value;
        });
        return indexedData;
    }
}
