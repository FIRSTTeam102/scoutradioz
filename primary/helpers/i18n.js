const logger = require('log4js').getLogger('i18n');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const sanitizeHtml = require('sanitize-html');

// Based on i18n-node, but designed for our specific use cases
class I18n {
	locales = {};
	config = {
		directory: '', // Directory to look for locales in
		cookie: 'language',
		queryParameter: 'uselang',
		defaultLocale: 'en',
		autoReload: false, // @todo: implement auto reloading
	};
	constructor(options) {
		// Merge options
		Object.assign(this.config, options);

		if (!this.config.directory) return logger.error('No directory specified for locales');

		// Load locales
		fs.readdir(this.config.directory, (err, files) => {
			if (err) return logger.error(err);

			files.forEach(file => {
				let locale = file.replace('.json', '');

				try {
					this.locales[locale] = require(path.join(this.config.directory, file));
				} catch (err) {
					logger.error(`Unable to load ${locale} locale`, err)
				}
			});
			logger.debug('Loaded languages:', Object.keys(this.locales));
		})

		this.locale = this.config.defaultLocale;
	}

	// Middleware for Express and Pug
	middleware() {
		return (req, res, next) => {
			logger.addContext('funcName', 'middleware');

			// Guess the locale from the request
			let locale = (
					(req.query && req.query[this.config.queryParameter] && (Array.isArray(req.query[this.config.queryParameter])
						// express will turn duplicate params into an array- we only want one
						? req.query[this.config.queryParameter][0]
						: req.query[this.config.queryParameter]
					))
					|| (req.cookies && req.cookies[this.config.cookie])
					|| req.acceptsLanguages(Object.keys(this.locales))
					|| this.config.defaultLocale
				).replace('_', '-').toLowerCase(); // treat something like en_US as en-us
			logger.debug(`Guessed locale: ${locale}`);

			// Set the locale
			this.locale = req.locale = res.locale = res.locals.locale = locale;

			// Add functions to the request
			for (const func of ['msg', 'msgMarked', 'getLocales', 'getLocaleName', 'getLocaleDirection']) {
				req[func] = res[func] = res.locals[func] = this[func].bind(this);
			}

			next();
			logger.removeContext('funcName', 'middleware');
		}
	}

	// Get info about all loaded locales
	getLocales() {
		return Object.keys(this.locales).map(locale => {
			return {
				lang: locale,
				name: this.getLocaleName(locale),
				dir: this.getLocaleDirection(locale)
			}
		})
	}

	// Get a locale name by its identifier
	getLocaleName(locale, inLocale) {
		return new Intl.DisplayNames([inLocale || locale], { type: 'language' }).of(locale);
	}

	// Get writing direction of a locale (ltr or rtl)
	getLocaleDirection(locale) {
		return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
	}

	// Finds an item in an object based on dot notation
	// 'a.b.c' => object.a.b.c
	_findInObject(target, object) {
		const indexOfDot = target.lastIndexOf('.');

		if (indexOfDot > 0 && indexOfDot < target.length - 1) {
			// The current item
			let item = null;

			// Split the provided term and run the callback for each subterm.
			target.split('.').reduce((previousValue, currentValue) => {
				item = null;

				// If the current target object (in the locale tree) doesn't exist or doesn't have the next subterm as a member, exit
				if (
					!previousValue ||
					!currentValue ||
					!Object.prototype.hasOwnProperty.call(previousValue, currentValue)
				) return null

				// Return a reference to the next deeper level in the tree
				return item = previousValue[currentValue];
			}, object);

			// Return the requested accessor.
			return item;
		}

		// No object notation, so we can just return the requested item
		return object[target] || null;
	}

	// @param {bool} allowTags - Allow any HTML tags in the message
	sanitizeHtml(dirty, allowTags = true) {
		return sanitizeHtml(dirty, {
			// we probably only want to allow inline elements, everything else should be done in views
			// CD 2022-05-24: allowing <p> because it might pop up
			allowedTags: allowTags ? ['a', 'br', 'p', 'span', 'b', 'strong', 'i', 'em', 'tt', 'code'] : [],
			allowedSchemes: ['http', 'https'],
			allowedAttributes: {
				...sanitizeHtml.defaults.allowedAttributes,
				'*': ['dir', 'lang']
			},
			disallowedTagsMode: 'escape' // leaves the content- maybe switch to 'discard'?
		});
	}

	// Finds a raw message in a specified locale
	_rawMsg(locale, msg) {
		// qqx will just return the message name
		if (locale === 'qqx') return `(${msg})`;

		// Look for the message in the current locale
		let result = this._findInObject(msg, this.locales[locale]);
		if (result) return result;

		// Otherwise, fallback to the next locale
		return this._rawMsg(fallbackLocales[locale] || this.config.defaultLocale, msg);
	}

	// Replace named keywords (eg. {name}) with arguments
	_paramterize(text, parameters) {
		// @todo: Make escaping work (eg. \{c} or {c\}c})
		if (parameters && typeof parameters === 'object') return text.replace(/\{([^}]+)\}/g, (match, key) => parameters[key] || match);
		return text;
	}

	// Returns a plain message with substituted args
	msg(name, parameters) {
		return this.sanitizeHtml(this._paramterize(this._rawMsg(this.locale, name), parameters), false);
	}

	// Returns a message with parsed markdown
	msgMarked(name, parameters) {
		return this.sanitizeHtml(marked.parseInline(this._paramterize(this._rawMsg(this.locale, name), parameters)));
	}

	// @todo: Implement pluralization function?
	// @todo: MessageFormat support
}

// ISO 639-1 language codes
const rtlLocales = ['ar', 'arc', 'ckb', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'sd', 'ur', 'yi', /* for testing */ 'rtl'];
const fallbackLocales = {
	'en-au': 'en',
	'en-gb': 'en',
	'en-us': 'en',
	'pt-br': 'pt',
	'yi': 'he',
	'zh': 'zh-hans',
	'zh-classical': 'lzh',
	'zh-cn': 'zh-hans',
	'zh-hant': 'zh-hans',
	'zh-hk': 'zh-hant',
	'zh-mo': 'zh-hk',
	'zh-my': 'zh-sg',
	'zh-sg': 'zh-hans',
	'zh-tw': 'zh-hant',
};

module.exports = { I18n };