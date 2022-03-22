'use strict';
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
