"use strict";
class Confirm {
    constructor(text, yesText, noText) {
        if (typeof text !== 'string')
            throw new TypeError('PasswordPrompt: text must be string.');
        if (!yesText)
            yesText = 'YES';
        if (!noText)
            noText = 'NO';
        this.text = text;
        this.yesText = yesText;
        this.noText = noText;
        this.animateDuration = 200;
        this.card = $();
        this.darkener = $();
    }
    static show(text, yesText, noText) {
        var newConfirm = new Confirm(text, yesText, noText);
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
        NotificationCard.container().append(card);
        this.darkener = $(document.createElement('div'))
            .addClass('canvas')
            .addClass('theme-darkener')
            .css('opacity', 0)
            .appendTo(NotificationCard.container())
            .on('click', this.cancel.bind(this));
        this.card.animate({ opacity: 1 }, this.animateDuration);
        this.darkener.animate({ opacity: 1 }, this.animateDuration);
        this.promise = new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
        });
        return this.promise;
    }
    resolve() {
        if (this.resolvePromise)
            this.resolvePromise({ cancelled: false });
        this.hide();
    }
    cancel() {
        if (this.resolvePromise)
            this.resolvePromise({ cancelled: true });
        this.hide();
    }
    hide() {
        this.darkener.animate({ opacity: 0 }, this.animateDuration);
        this.card.animate({ opacity: 0 }, {
            duration: this.animateDuration,
            complete: () => {
                this.card.remove();
                this.darkener.remove();
            }
        });
    }
    _enrichText() {
        var text = this.text;
        var enrichedText = $(document.createElement('span'))
            .text(text);
        enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '*', '<b>', '</b>');
        enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '_', '<i>', '</i>');
        enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '\n', '</br>');
        enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '/n', '</br>');
        return enrichedText;
    }
}
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
                cb(null, response);
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
var navMenu;
$(() => {
    navMenu = new NavigationBar();
});
class NavigationBar {
    constructor() {
        this.opts = {
            openingInterval: 25,
            fastTransitionTime: 200,
            slowTransitionTime: 400,
            slowTransition: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            fastTransition: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
            panThreshold: 30,
        };
        this.opened = false;
        this.moving = false;
        this.panning = false;
        this.pendingAnimationFrame = false;
        this.menuElem = $('#menu');
        this.barElem = $('#headerbar');
        this.overlayElem = $('#overlay');
        if (typeof navMenuTitle === 'string')
            this.title = navMenuTitle;
        else
            this.title = 'Menu';
        if (footerContents instanceof Array)
            this.footerContents = footerContents;
        else
            this.footerContents = [];
        this.menu = new Mmenu('#menu', {
            navbar: {
                title: this.title,
            },
            offCanvas: false,
            counters: true,
            extensions: {
                'all': ['border-full'],
            },
            navbars: [
                {
                    position: 'bottom',
                    content: this.footerContents,
                }
            ],
        }, {});
        this.api = this.menu.API;
        this.menuElem.detach().appendTo(document.body);
        this.eventHandlers();
    }
    eventHandlers() {
        $('#burger').click(() => {
            if (!this.opened && !this.moving) {
                this.preMenuOpen();
                setTimeout(() => {
                    this.menuOpen();
                }, this.opts.openingInterval);
            }
            else if (!this.moving) {
                this.preMenuClose();
                setTimeout(() => {
                    this.menuClose();
                }, this.opts.openingInterval);
            }
        });
        $('#page').click(() => {
            if (this.opened && !this.moving) {
                this.preMenuClose();
                setTimeout(() => {
                    this.menuClose();
                }, this.opts.openingInterval);
            }
        });
    }
    preMenuOpen() {
        const positions = this.calculateTransformPosition(0);
        this.menuElem.css({
            display: 'flex',
            transform: `translate3d(${positions.menu}, 0, 0)`,
            transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
        });
        this.barElem.css({
            transform: `translate3d(${positions.bar}, 0, 0)`,
            transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
        });
        this.overlayElem.css({
            display: 'flex',
            opacity: 0,
            transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
        });
    }
    menuOpen() {
        this.moving = true;
        const positions = this.calculateTransformPosition(1);
        requestAnimationFrame(() => {
            this.menuElem.css({
                transform: `translate3d(${positions.menu}, 0, 0)`,
            });
            this.barElem.css({
                transform: `translate3d(${positions.bar}, 0, 0)`,
            });
            this.overlayElem.css({
                opacity: 1,
            });
        });
        $('#burger').addClass('mm-wrapper_opened');
        setTimeout(() => {
            this.postMenuOpen();
        }, this.opts.slowTransitionTime);
    }
    postMenuOpen() {
        this.opened = true;
        this.moving = false;
    }
    preMenuClose() {
        this.menuElem.css({
            transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
        });
        this.barElem.css({
            transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
        });
        this.overlayElem.css({
            transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
        });
    }
    menuClose() {
        this.moving = true;
        const positions = this.calculateTransformPosition(0);
        requestAnimationFrame(() => {
            this.menuElem.css({
                transform: `translate3d(${positions.menu}, 0, 0)`,
            });
            this.barElem.css({
                transform: `translate3d(${positions.bar}, 0, 0)`,
            });
            this.overlayElem.css({
                opacity: 0,
            });
        });
        $('#burger').removeClass('mm-wrapper_opened');
        setTimeout(() => {
            this.postMenuClose();
        }, this.opts.slowTransitionTime);
    }
    postMenuClose() {
        this.opened = false;
        this.moving = false;
        this.menuElem.css({
            display: 'none',
            transform: '',
            transition: '',
        });
        this.barElem.css({
            transform: '',
            transition: '',
        });
        this.overlayElem.css({
            opacity: '',
            display: 'none',
        });
    }
    calculateTransformPosition(percentageOpened) {
        if (percentageOpened > 1)
            percentageOpened = 1;
        if (percentageOpened < 0)
            percentageOpened = 0;
        const windowWidth = window.innerWidth;
        var positions;
        if (windowWidth < 550) {
            positions = {
                menu: -80 * (1 - percentageOpened) + 'vw',
                bar: 80 * percentageOpened + 'vw'
            };
        }
        else {
            positions = {
                menu: Math.floor((1 - percentageOpened) * -440) + 'px',
                bar: Math.floor((percentageOpened) * 440) + 'px'
            };
        }
        return positions;
    }
}
class NotificationCard {
    constructor(text, options) {
        if (!options)
            options = {};
        this.text = text;
        if (typeof text != 'string') {
            throw new TypeError('NotificationCard: text must be string.');
        }
        if (typeof options != 'object') {
            throw new TypeError('NotificationCard: opts must be object.');
        }
        this.opts = this._filterOptions(options);
        this.card = $();
    }
    static show(text, opts) {
        var newCard = new NotificationCard(text, opts);
        newCard.show();
        return newCard;
    }
    static error(text, opts) {
        if (!opts)
            opts = {};
        opts.type = 'error';
        return NotificationCard.show(text, opts);
    }
    static good(text, opts) {
        if (!opts)
            opts = {};
        opts.type = 'good';
        return NotificationCard.show(text, opts);
    }
    static warn(text, opts) {
        if (!opts)
            opts = {};
        opts.type = 'warn';
        return NotificationCard.show(text, opts);
    }
    static container() {
        var containerElement = $('#notificationcard-container');
        if (!containerElement[0]) {
            containerElement = $(document.createElement('div'))
                .addClass('notification-card-container')
                .attr('id', 'notificationcard-container')
                .appendTo(document.body);
        }
        return containerElement;
    }
    show() {
        var card = $(document.createElement('div'))
            .addClass('notification-card')
            .css({
            'background-color': this.opts.color,
            'border-bottom-color': this.opts.borderColor,
            'color': this.opts.textColor,
        });
        var enrichedText = this._enrichText();
        var text = $(document.createElement('div'))
            .addClass('notification-card-content')
            .html(enrichedText.html());
        this._textContent = text;
        if (this.opts.exitable) {
            var exitBtn = $(document.createElement('div'))
                .addClass('notification-card-exit')
                .css({})
                .text('X')
                .on('click', () => {
                this.remove();
                if (this.opts.onexit) {
                    this.opts.onexit();
                }
            });
            card.append(exitBtn);
        }
        card.append(text);
        NotificationCard.container().append(card);
        if (this.opts.darken) {
            this.darkener = $(document.createElement('div'))
                .addClass('canvas')
                .addClass('theme-darkener')
                .appendTo(NotificationCard.container());
        }
        this.card = card;
        if (this.opts.ttl != 0) {
            setTimeout(() => {
                this.remove(1900);
            }, this.opts.ttl);
        }
        return this;
    }
    setText(newText) {
        this.text = newText;
        var enrichedText = this._enrichText();
        if (this._textContent)
            this._textContent.html(enrichedText.html());
    }
    remove(time) {
        var removeTime = 0;
        if (typeof time == 'number') {
            removeTime = time;
        }
        if (this.card) {
            $(this.card).css('opacity', 0);
            setTimeout(() => {
                this.card.remove();
                if (this.opts.darken && this.darkener) {
                    $(this.darkener).remove();
                }
            }, removeTime);
        }
        return this;
    }
    _filterOptions(options) {
        var defaultOpts = new NotificationCardOptions();
        var opts = defaultOpts;
        for (var option in opts) {
            if (options.hasOwnProperty(option)) {
                switch (option) {
                    case 'type':
                        if (typeof options[option] == 'string')
                            opts[option] = options[option];
                        else
                            throw new TypeError('NotificationCard.opts.type must be string.');
                        break;
                    case 'ttl':
                        if (typeof options[option] == 'number')
                            opts[option] = options[option];
                        else
                            throw new TypeError('NotificationCard.opts.ttl must be a number.');
                        break;
                    case 'exitable':
                        if (typeof options[option] == 'boolean')
                            opts[option] = options[option];
                        else
                            throw new TypeError('NotificationCard.opts.exitable must be a boolean.');
                        break;
                    case 'darken':
                        if (typeof options[option] == 'boolean')
                            opts[option] = options[option];
                        else
                            throw new TypeError('NotificationCard.opts.darken must be a boolean.');
                        break;
                    case 'onexit':
                        if (typeof options[option] == 'function')
                            opts[option] = options[option];
                        else
                            throw new TypeError('NotificationCard.opts.onexit must be a function.');
                        break;
                    default:
                        throw new ReferenceError('NotificationCard.opts: Unknown option ' + option);
                }
            }
        }
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
                opts.color = 'rgb(240,245,255)';
                opts.borderColor = 'rgb(80,80,84)';
                opts.textColor = 'rgb(0,0,0)';
        }
        return opts;
    }
    _enrichText() {
        var text = this.text;
        var enrichedText = $(document.createElement('span'))
            .text(text);
        enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '*', '<b>', '</b>');
        enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '_', '<i>', '</i>');
        enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '\n', '</br>');
        enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '/n', '</br>');
        return enrichedText;
    }
    static _enrichWithClosingTags(html, key, openTag, closeTag) {
        var locationsOfKey = [];
        for (var i = 0; i < html.length; i++) {
            if (html.substring(i, i + key.length) == key) {
                locationsOfKey.push(i);
            }
        }
        var numIterations = 0;
        while (locationsOfKey.length > 1) {
            var lengthAddition = numIterations * (openTag.length + closeTag.length - 2 * key.length);
            var thisIndex = locationsOfKey.splice(0, 1)[0] + lengthAddition;
            var nextIndex = locationsOfKey.splice(0, 1)[0] + lengthAddition;
            html = html.slice(0, thisIndex) + openTag + html.slice(thisIndex + key.length, nextIndex) + closeTag + html.slice(nextIndex + key.length);
            numIterations++;
        }
        var enrichedText = $(document.createElement('span'))
            .html(html);
        return enrichedText;
    }
    static _enrichWithSelfClosingTags(html, key, tag) {
        var locationsOfKey = [];
        for (var i = 0; i < html.length; i++) {
            if (html.substring(i, i + key.length) == key) {
                locationsOfKey.push(i);
            }
        }
        var numIterations = 0;
        while (locationsOfKey.length > 0) {
            var lengthAddition = numIterations * (tag.length - key.length);
            var thisIndex = locationsOfKey.splice(0, 1)[0] + lengthAddition;
            html = html.slice(0, thisIndex) + tag + html.slice(thisIndex + key.length);
            numIterations++;
        }
        var enrichedText = $(document.createElement('span'))
            .html(html);
        return enrichedText;
    }
}
class NotificationCardOptions {
    constructor() {
        this.type = 'normal';
        this.ttl = 2000;
        this.exitable = false;
        this.darken = false;
        this.onexit = null;
    }
}
class PasswordPrompt {
    constructor(text) {
        if (typeof text !== 'string')
            throw new TypeError('PasswordPrompt: text must be string.');
        this.text = text;
        this.animateDuration = 200;
        this.card = $();
        this.darkener = $();
        this.passwordField = $();
    }
    static show(text) {
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
        this.darkener = $(document.createElement('div'))
            .addClass('canvas')
            .addClass('theme-darkener')
            .css('opacity', 0)
            .appendTo(NotificationCard.container())
            .on('click', this.cancel.bind(this));
        this.card.animate({ opacity: 1 }, this.animateDuration);
        this.darkener.animate({ opacity: 1 }, this.animateDuration);
        passwordField.focus();
        this.promise = new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
        });
        return this.promise;
    }
    onKeyDown(e) {
        switch (e.key) {
            case 'Enter':
                this.resolve();
                break;
            case 'Escape':
                this.cancel();
                break;
        }
    }
    resolve() {
        if (this.resolvePromise)
            this.resolvePromise({ cancelled: false, password: this.passwordField.val() });
        this.hide();
    }
    cancel() {
        if (this.resolvePromise)
            this.resolvePromise({ cancelled: true });
        this.hide();
    }
    hide() {
        this.darkener.animate({ opacity: 0 }, this.animateDuration);
        this.card.animate({ opacity: 0 }, {
            duration: this.animateDuration,
            complete: () => {
                this.card.remove();
                this.darkener.remove();
            }
        });
    }
    _enrichText() {
        var text = this.text;
        var enrichedText = $(document.createElement('span'))
            .text(text);
        enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '*', '<b>', '</b>');
        enrichedText = NotificationCard._enrichWithClosingTags(enrichedText.html(), '_', '<i>', '</i>');
        enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '\n', '</br>');
        enrichedText = NotificationCard._enrichWithSelfClosingTags(enrichedText.html(), '/n', '</br>');
        return enrichedText;
    }
}
if (!$) {
    console.error('scoutradioz.js error: jQuery not enabled');
}
$(() => {
    if (Cookies.get('accepted') != 'true') {
        var cookiesMessage = new NotificationCard('Scoutradioz uses some cookies in order to operate. We do not use third party cookies or tracking cookies.', { ttl: 0, exitable: true, onexit: function () {
                Cookies.set('accepted', 'true', { expires: 1000 });
            } });
    }
    Cookies.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
});
(() => {
    const resizeCallbacks = [];
    window.onResize = function (cb) {
        resizeCallbacks.push(cb);
        cb();
    };
    let ticking = false;
    $(window).on('resize', () => {
        if (resizeCallbacks.length > 0) {
            if (!ticking) {
                ticking = true;
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        for (let cb of resizeCallbacks) {
                            cb();
                        }
                        ticking = false;
                    });
                }, 50);
            }
        }
    });
    window.assert = function (condition, message) {
        if (!condition) {
            var x = new Error();
            NotificationCard.error(`ERROR: ${message}\nPlease report as an issue on our GitHub page.\n\nCall stack: ${x.stack}`, { exitable: true, ttl: 0 });
        }
    };
    var debugLogger = document.createElement('div');
    $(debugLogger).css({
        'background-color': 'white',
        'color': 'black',
        'z-index': '99',
        'position': 'absolute',
        'top': '0',
        'width': '25%',
        'padding': '8px 16px',
    });
    window.debugToHTML = function (message) {
        var text;
        switch (typeof message) {
            case 'string':
            case 'number':
                text = message;
                break;
            case 'object':
                text = JSON.stringify(message);
                break;
            default:
                text = message;
        }
        if (!$(debugLogger).parent()[0]) {
            $(document.body).append(debugLogger);
        }
        var newTextElem = document.createElement('pre');
        $(newTextElem).text(text);
        $(debugLogger).append(newTextElem);
    };
})();
function scrollToId(id) {
    var elem = document.getElementById(id);
    if (elem)
        elem.scrollIntoView({ behavior: 'smooth' });
    else
        console.error(`Element with id ${id} not found.`);
}
function share(orgKey) {
    var origin = window.location.origin;
    var pathname = window.location.pathname;
    var search = window.location.search;
    if (orgKey != false) {
        pathname = '/' + orgKey + pathname;
    }
    var shareURL = origin + pathname + search;
    console.log(shareURL);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        console.log('Attempting navigator.clipboard.writeText');
        navigator.clipboard.writeText(shareURL)
            .then(() => {
            NotificationCard.good('Copied link to clipboard. Share it in an app.');
        })
            .catch(err => {
            console.log(err);
            copyClipboardDom(shareURL);
        });
    }
    else {
        console.log('navigator.clipboard.writeText does not exist; falling back to DOM copy');
        copyClipboardDom(shareURL);
    }
}
function copyClipboardDom(text) {
    try {
        console.log('Attempting DOM copy');
        var shareURLInput = $('#shareURLInput');
        shareURLInput.attr('value', text);
        shareURLInput[0].select();
        shareURLInput[0].setSelectionRange(0, 99999);
        document.execCommand('copy');
        NotificationCard.good('Copied link to clipboard. Share it in an app.');
    }
    catch (err) {
        console.error(err);
        NotificationCard.error(`Could not copy to clipboard. Error: ${err.message}`);
    }
}
