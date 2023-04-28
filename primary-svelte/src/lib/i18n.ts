import { getLogger } from 'log4js';
import { readdir } from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

import type express from 'express';

const logger = getLogger('i18n');

marked.setOptions({
	gfm: true,
	breaks: true,
	headerIds: false,
});

// Based on i18n-node, but designed for our specific use cases
export class I18n {
	locales: Dict<Dict<LocaleTree>> = {};
	locale: string; // Current locale to use for languages
	reqFallbackChain: string[] = []; // Set by the middleware on each request, has the request's fallbacks
	config: I18nOptions = {
		directory: '', // Directory to look for locales in
		cookie: 'language',
		queryParameter: 'uselang',
		defaultLocale: 'en',
	};
	constructor(options: Partial<I18nOptions>) {
		// Merge options
		Object.assign(this.config, options);

		if (!this.config.directory) throw logger.error('No directory specified for locales');

		// Load locales
		readdir(this.config.directory, (err, files) => {
			if (err) return logger.error(err);

			files.forEach((file) => {
				let locale = file.replace('.json', '');

				try {
					// eslint-disable-next-line global-require
					this.locales[locale] = require(path.join(this.config.directory, file));
				}
				catch (err) {
					logger.error(`Unable to load ${locale} locale`, err);
				}
			});
			logger.debug('Loaded languages:', Object.keys(this.locales));
		});

		this.locale = this.config.defaultLocale;
	}

	// Middleware for Express and Pug
	// middleware(): express.RequestHandler {
	// 	return (req, res, next) => {
	// 		logger.addContext('funcName', 'middleware');

	// 		/*
	// 		 * Guess the locale from the request
	// 		 *
	// 		 * Locales are tried in this order:
	// 		 * - First possible locale
	// 		 * - Fallbacks of the first possible locale
	// 		 * - Second possible locale
	// 		 * - Fallbacks of the second possible locale
	// 		 * etc.
	// 		 *
	// 		 * Inner fallback logic is implemented in _rawMsg()
	// 		 */
	// 		let possibleLocales = [
	// 			// query parameter
	// 			req.query &&
	// 				req.query[this.config.queryParameter] &&
	// 				(Array.isArray(req.query[this.config.queryParameter])
	// 					? // express will turn duplicate params into an array- we only want one
	// 					(req.query[this.config.queryParameter] as Array<string>)[0]
	// 					: req.query[this.config.queryParameter]),
	// 			// cookie
	// 			req.cookies && req.cookies[this.config.cookie],
	// 			// Accept-Language header
	// 			...req.acceptsLanguages(),
	// 		];
	// 		this.reqFallbackChain = []; // reset it for each request
	// 		for (let locale_ of possibleLocales) {
	// 			try {
	// 				let locale = new Intl.Locale(locale_).baseName?.toLocaleLowerCase();
	// 				if (
	// 					!locale || // invalid
	// 					this.reqFallbackChain.includes(locale) || // already in the chain
	// 					(this.reqFallbackChain.length > 0 && devLocales.includes(locale)) // shouldn't be a fallback
	// 				)
	// 					continue;
	// 				this.reqFallbackChain.push(locale);
	// 			}
	// 			catch (e) {
	// 				// failed to parse locale
	// 			}
	// 		}
	// 		this.locale = this.reqFallbackChain[0] || this.config.defaultLocale;

	// 		logger.debug('Locale chain:', this.reqFallbackChain);

	// 		// Set the locale
	// 		req.locale = res.locale = res.locals.locale = this.locale;

	// 		// Add functions to the request
	// 		// link:../namespace-extensions.d.ts:I18nExpressExtensions
	// 		for (const func of ['msg', 'msgUrl', 'msgJs', 'msgMarked', 'getLocales', 'getLocaleName', 'getLocaleDirection']) {
	// 			// eslint-disable-next-line @typescript-eslint/no-explicit-any
	// 			(req as Dict<any>)[func] = (res as Dict<any>)[func] = res.locals[func] = (this[func as keyof I18n] as typeof this.msg).bind(this);
	// 		}

	// 		next();
	// 		logger.removeContext('funcName');
	// 	};
	// }

	// Get info about all loaded locales
	getLocales() {
		return Object.keys(this.locales).map((locale) => {
			return {
				lang: locale,
				name: this.getLocaleName(locale),
				dir: this.getLocaleDirection(locale),
			};
		});
	}

	// Get a locale name by its identifier
	getLocaleName(locale: string, inLocale?: string) {
		return new Intl.DisplayNames([inLocale || locale], { type: 'language' }).of(locale);
	}

	// Get writing direction of a locale (ltr or rtl)
	getLocaleDirection(locale: string) {
		return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
	}

	// Finds an item in an object based on dot notation
	// 'a.b.c' => object.a.b.c
	_findInObject(target: string, object: LocaleTree): string {
		const indexOfDot = target.lastIndexOf('.');

		if (indexOfDot > 0 && indexOfDot < target.length - 1) {
			// The current item
			let item: string | LocaleTree = '';

			// Split the provided term and run the callback for each subterm.
			target.split('.').reduce((previousValue: LocaleTree | string, currentValue) => {
				item = '';

				// If the current target object (in the locale tree) doesn't exist or doesn't have the next subterm as a member, exit
				if (!previousValue || !currentValue || !Object.prototype.hasOwnProperty.call(previousValue, currentValue)) return '';

				// Return a reference to the next deeper level in the tree
				return (item = (previousValue as LocaleTree)[currentValue]);
			}, object);

			// Return the requested accessor.
			return item;
		}

		// No object notation
		return (object[target] as string) || '';
	}

	// @param {bool} allowTags - Allow any HTML tags in the message
	sanitizeHtml(dirty: string, allowTags = true) {
		return sanitizeHtml(dirty, {
			// we probably only want to allow inline elements, everything else should be done in views
			// CD 2022-05-24: allowing <p> because it might pop up
			allowedTags: allowTags ? ['a', 'br', 'p', 'span', 'b', 'strong', 'i', 'em', 'tt', 'code', 'ol', 'ul', 'li'] : [],
			allowedSchemes: ['http', 'https'],
			allowedAttributes: {
				...sanitizeHtml.defaults.allowedAttributes,
				'*': ['dir', 'lang', 'class', 'id'],
			},
			disallowedTagsMode: 'escape', // leaves the content- maybe switch to 'discard'?
		});
	}

	// Finds a raw message in a specified locale
	// @param {string} locale - locale to start searching from
	// @param {number} localeFallbackIndex - index of this.reqFallbackChain to use
	// @see {@link I18n#middleware}
	_rawMsg(msg: string, locale: string = this.locale, localeFallbackIndex = 0): string {
		// Disable logger here - this makes a lot of output for every message
		const logger = getLogger('off');

		logger.debug('Looking for message', msg, 'in', locale);
		// qqx will just return the message name (but it should be using @qqxOutput)
		if (locale === 'qqx') return msg;

		// Look for the message in the current locale
		let result = this.locales[locale] && this._findInObject(msg, this.locales[locale]);
		if (result) {
			logger.debug('Found result');
			return result;
		}

		// Don't recurse forever
		if (locale === this.config.defaultLocale || localeFallbackIndex === this.reqFallbackChain.length) {
			logger.debug('Done recursing');
			return msg;
		}

		// Otherwise, fallback to
		// 1. the next locale in the current fallback chain
		if (fallbackLocales[locale]) {
			logger.debug('Falling back to the next locale in the current fallback chain');
			return this._rawMsg(msg, fallbackLocales[locale], localeFallbackIndex);
		}
		// 2. the first locale in the next fallback chain
		else if (localeFallbackIndex < this.reqFallbackChain.length) {
			logger.debug('Falling back to the first locale in the next fallback chain');
			return this._rawMsg(msg, this.reqFallbackChain[localeFallbackIndex + 1], localeFallbackIndex + 1);
		}
		// 3. the default locale
		else {
			logger.debug('Falling back to the default locale');
			return this._rawMsg(msg, this.config.defaultLocale);
		}
	}

	// Replace named keywords (eg. {name}) with arguments
	_parameterize(text: string, parameters?: I18nParameters) {
		// @todo: Make escaping work (eg. \{c} or {c\}c})
		if (parameters && typeof parameters === 'object')
			return text.replace(/\{([^}]+)\}/g, (match, key) => {
				let result = parameters[key];
				return result !== undefined ? (typeof result === 'string' ? result : String(result)) : `{${key}}`;
			});
		return text;
	}

	// Returns a plain message with substituted args
	// @ts-ignore
	@qqxOutput()
	msg(name: string, parameters?: I18nParameters) {
		return this.sanitizeHtml(this._parameterize(this._rawMsg(name, this.locale), parameters), false);
	}

	// Returns a URL-encoded message
	// @ts-ignore
	@qqxOutput(encodeURI)
	msgUrl(name: string, parameters?: I18nParameters) {
		return encodeURI(this.msg(name, parameters));
	}

	// Returns a JS-encoded message for use in embedded scripts
	// @ts-ignore
	@qqxOutput(JSON.stringify)
	msgJs(name: string, parameters?: I18nParameters) {
		return JSON.stringify(this.msg(name, parameters));
	}

	// Returns a message with parsed markdown
	// @ts-ignore
	@qqxOutput()
	msgMarked(name: string, parameters: I18nParameters) {
		let text = this._parameterize(this._rawMsg(name, this.locale), parameters);
		// CD 2023-04-13: we don't want an everything wrapped by a p if it's just one line
		// text.replace(/^<p>(.*)<\/p>\n?$/s, '$1')
		return this.sanitizeHtml(text.trim().includes('\n') ? marked.parse(text) : marked.parseInline(text));
	}

	// @todo: Implement pluralization function?
	// @todo: MessageFormat support
}

// Decorator to format qqx output
// @param {Function} outputWrapper - qqx output willl be wrapped in this
function qqxOutput(outputWrapper = (output: string) => output) {
	// this is a function for a reason
	return function (obj: unknown, func: string, descriptor: PropertyDescriptor) {
		const original = descriptor.value;

		descriptor.value = function (this: I18n, query: string, parameters?: I18nParameters) {
			if (this.locale === 'qqx') {
				return outputWrapper(this.sanitizeHtml(`${func}(${query}${parameters && Object.keys(parameters).length !== 0 ? ', ' + JSON.stringify(parameters) : ''})`));
			}
			else {
				return original.apply(this, arguments); // eslint-disable-line prefer-rest-params
			}
		};
	};
}

// ISO 639-1 language codes
const rtlLocales = ['ar', 'arc', 'ckb', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'sd', 'ur', 'yi', /* for testing */ 'rtl'];
const fallbackLocales: Record<string, string> = {
	'en-au': 'en',
	'en-gb': 'en',
	'en-us': 'en',
	'es': 'es-mx',
	'fr-ca': 'fr',
	'fr-fr': 'fr',
	'pt': 'pt-br',
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
const devLocales = ['qqx', 'rtl'];

interface I18nOptions {
	directory: string;
	cookie: string;
	queryParameter: string;
	defaultLocale: string;
}

interface LocaleTree {
	[key: string]: string | LocaleTree;
}

interface I18nParameters {
	[key: string]: string | number; // anything that can be substituted into a string
}

// link:../namespace-extensions.d.ts:I18nExpressExtensions
