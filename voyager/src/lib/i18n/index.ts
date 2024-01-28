// Port of i18n.ts from primary but changed to run in-browser
import type { LoadEvent } from '@sveltejs/kit';
import { getLogger } from '../logger';
import { fetchJSON } from '../utils';
import Cookies from 'js-cookie';
import { browser } from '$app/environment';

const logger = getLogger('i18n');

export class I18n {
	locales: Dict<LocaleTree> = {};
	locale: string; // Current locale to use for languages
	availableLocales: Record<string, () => Promise<LocaleTree>>;
	fallbackChain: string[] = []; // List of fallback languages
	config: I18nOptions = {
		cookie: 'language',
		queryParameter: 'uselang',
		defaultLocale: 'en'
	};
	/**
	 * If isReady = false, this means that it has not been set up since the page load,
	 * meaning that middleware() has not finished running
	 *
	 * middleware() is intended to run inside +layout.ts, which does not finish running
	 * before +page.ts, so if i18n is to be used inside +page.ts, it individually needs
	 * to wait until i18n is ready.
	 */
	isReady = false;
	/**
	 * If isReady = false, this means that it has not been set up since the page load,
	 * meaning that middleware() has not finished running
	 *
	 * middleware() is intended to run inside +layout.ts, which does not finish running
	 * before +page.ts, so if i18n is to be used inside +page.ts, it individually needs
	 * to wait until i18n is ready, by doing `await i18n.ready`
	 */
	ready: Promise<void>;
	private readyResolve!: () => void;

	constructor(options: Partial<I18nOptions>) {
		// Merge options
		Object.assign(this.config, options);

		// Get list of locales that are available to be imported
		// TODO maybe: Refactor to store locales in Dexie to reduce network activity?
		const locales = import.meta.glob('./locales/*.json') as Record<
			string,
			() => Promise<LocaleTree>
		>;
		this.availableLocales = locales;

		this.locale = this.config.defaultLocale;

		this.ready = new Promise((resolve) => (this.readyResolve = resolve));
	}

	/**
	 * "Middleware" that ensures all user locales are loaded before the request finishes.
	 * Should be run inside +layout.ts
	 */
	async middleware() {
		let possibleLocales = [
			// 1st priority: query parameter (if set)
			('location' in globalThis) && new URLSearchParams(location.search).get(this.config.queryParameter),
			// 2nd priority: cookie (if set)
			Cookies && Cookies.get(this.config.cookie),
			// then, navigator.languages (browser default[s])
			...navigator.languages
		];
		
		this.fallbackChain = []; // Reset for each page load
		for (let _locale of possibleLocales) {
			try {
				if (!_locale) continue; // for undefined/false/null inside possibleLocales

				let locale = new Intl.Locale(_locale).baseName?.toLocaleLowerCase();
				if (
					!locale || // invalid locale
					this.fallbackChain.includes(locale) || // already in the chain
					(this.fallbackChain.length > 0 && devLocales.includes(locale)) // shouldn't be a fallback
				)
					continue;
				this.fallbackChain.push(locale);
				// If this locale has not yet been loaded, fetch it now
				if (!this.locales[locale]) {
					let jsonImportKey = `./locales/${locale}.json`;
					if (this.availableLocales[jsonImportKey]) {
						logger.debug(`Fetching locale ${jsonImportKey} for locale ${locale}`);
						this.locales[locale] = await this.availableLocales[jsonImportKey]();
					} else {
						logger.debug(`Locale ${jsonImportKey} could not be found`);
					}
				}
			} catch (e) {
				logger.error('Failed to parse locale: ', _locale, 'with error:', e);
			}
		}
		this.locale = this.fallbackChain[0] || this.config.defaultLocale;
		
		logger.debug('Locale chain:', this.fallbackChain);
		this.notifyReady();
	}

	private notifyReady() {
		logger.debug('Running notifyReady');
		this.isReady = true;
		this.readyResolve();
	}

	/** Get info about all loaded locales */
	getLocales() {
		return Object.keys(this.availableLocales).map((localePath) => {
			// e.g. ./locales/en.json -> en
			let locale = localePath.replace('./locales/', '').replace('.json', '')
			return {
				lang: locale,
				name: this.getLocaleName(locale),
				dir: this.getLocaleDirection(locale)
			};
		});
	}

	/** Get a locale name by its identifier */
	getLocaleName(locale: string, inLocale?: string) {
		return new Intl.DisplayNames([inLocale || locale], { type: 'language' }).of(locale);
	}

	/** Get writing direction of a locale (ltr or rtl) */
	getLocaleDirection(locale: string) {
		return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
	}

	/**
	 * Finds an item in an object based on dot notation
	 * 'a.b.c.' => object.a.b.c
	 */
	private findInObject(target: string, object: LocaleTree): string {
		type Item = string | LocaleTree;

		const indexOfDot = target.lastIndexOf('.');

		if (indexOfDot > 0 && indexOfDot < target.length - 1) {
			// The current item
			let item: Item = '';

			// Split the provided term and run the callback for each subterm.
			target.split('.').reduce((previousValue: Item, currentValue) => {
				item = '';

				// If the current target object (in the locale tree) doesn't exist or doesn't
				// 	have the next subterm as a member, exit
				if (
					!previousValue ||
					!currentValue ||
					!Object.prototype.hasOwnProperty.call(previousValue, currentValue)
				)
					return '';

				// Return a reference to the next deeper level in the tree
				return (item = (previousValue as LocaleTree)[currentValue]);
			}, object);

			// Return the requested accessor.
			return item;
		}

		// If there was no object notation in the string
		return (object[target] as string) || '';
	}

	/**
	 * Finds a raw message in a specified locale
	 * @param msg The message string
	 * @param locale Locale to start searching from
	 * @param localeFallbackIndex Index of this.reqFallbackChain to use
	 * @see {@link I18n#middleware}
	 */
	private rawMsg(msg: string, locale: string = this.locale, localeFallbackIndex = 0): string {
		if (!this.isReady) {
			throw new Error(
				'i18n.rawMsg() was called before it was ready. Either middleware() was not called at all or rawMsg() was called before middleware() finished. Did you await i18n.ready?'
			);
		}
		logger.trace('Looking for message', msg, 'in', locale);
		// qqx will just return the message name (but it should be using @qqxOutput)
		if (locale === 'qqx') return msg;

		// Look for the message in the current locale
		let result = this.locales[locale] && this.findInObject(msg, this.locales[locale]);
		if (result) {
			logger.trace('Found result');
			return result;
		}

		// Don't recurse forever
		if (locale === this.config.defaultLocale || localeFallbackIndex === this.fallbackChain.length) {
			logger.trace('Done recursing');
			return msg;
		}

		// Otherwise, fallback to
		// 1. the next locale in the current fallback chain
		if (fallbackLocales[locale]) {
			logger.trace('Falling back to the next locale in the current fallback chain');
			return this.rawMsg(msg, fallbackLocales[locale], localeFallbackIndex);
		}
		// 2. the first locale in the next fallback chain
		else if (localeFallbackIndex < this.fallbackChain.length) {
			logger.trace('Falling back to the first locale in the next fallback chain');
			return this.rawMsg(msg, this.fallbackChain[localeFallbackIndex + 1], localeFallbackIndex + 1);
		}
		// 3. the default locale
		else {
			logger.trace('Falling back to the default locale');
			return this.rawMsg(msg, this.config.defaultLocale);
		}
	}

	/** Replace named keywords (e.g. {name}) with arguments */
	private parameterize(text: string, parameters?: I18nParameters) {
		// TODO: Make escaping work (e.g. \{C} or {c\}c})
		if (parameters && typeof parameters === 'object')
			return text.replace(/\{([^}]+)\}/g, (match, key) => {
				let result = parameters[key];
				return result !== undefined
					? typeof result === 'string'
						? result
						: String(result)
					: `{${key}}`;
			});
		return text;
	}

	sanitizeHTML(dirty: string, allowTags?: boolean) {
		return dirty;
	}

	/** Returns a plain message with substituted args */
	@qqxOutput()
	msg(name: string, parameters?: I18nParameters) {
		return this.parameterize(this.rawMsg(name, this.locale), parameters);
	}

	/** Returns a URL-encoded message */
	@qqxOutput(encodeURI)
	msgUrl(name: string, parameters?: I18nParameters) {
		return encodeURI(this.msg(name, parameters));
	}

	/**
	 * Returns a JS-encoded message for use in embedded scripts
	 * JL note: Might not be needed?
	 */
	@qqxOutput(JSON.stringify)
	msgJs(name: string, parameters?: I18nParameters) {
		return JSON.stringify(this.msg(name, parameters));
	}

	// TODO: Implement pluralization function?
	// TODO: MessageFormat support
}

// Decorator to format qqx output
// @param {Function} outputWrapper - qqx output willl be wrapped in this
function qqxOutput(outputWrapper = (output: string) => output) {
	// this is a function for a reason
	return function (obj: unknown, func: string, descriptor: PropertyDescriptor) {
		const original = descriptor.value;

		descriptor.value = function (this: I18n, query: string, parameters?: I18nParameters) {
			if (this.locale === 'qqx') {
				// JL: removed this.sanitizeHtml
				return outputWrapper(
					`${func}(${query}${
						parameters && Object.keys(parameters).length !== 0
							? ', ' + JSON.stringify(parameters)
							: ''
					})`
				);
			} else {
				return original.apply(this, arguments); // eslint-disable-line prefer-rest-params
			}
		};
	};
}
// ISO 639-1 language codes
const rtlLocales = [
	'ar',
	'arc',
	'ckb',
	'dv',
	'fa',
	'ha',
	'he',
	'khw',
	'ks',
	'ku',
	'ps',
	'sd',
	'ur',
	'yi',
	/* for testing */ 'rtl'
];
const fallbackLocales: Record<string, string> = {
	'en-au': 'en',
	'en-gb': 'en',
	'en-us': 'en',
	es: 'es-mx',
	'fr-ca': 'fr',
	'fr-fr': 'fr',
	pt: 'pt-br',
	yi: 'he',
	zh: 'zh-hans',
	'zh-classical': 'lzh',
	'zh-cn': 'zh-hans',
	'zh-hant': 'zh-hans',
	'zh-hk': 'zh-hant',
	'zh-mo': 'zh-hk',
	'zh-my': 'zh-sg',
	'zh-sg': 'zh-hans',
	'zh-tw': 'zh-hant'
};
const devLocales = ['qqx', 'rtl'];

interface I18nOptions {
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

// Singleton instance and exported methods
export const i18n = new I18n({});
// @ts-ignore
if (browser) window.i18n = i18n; // For debugging

export const msg = i18n.msg.bind(i18n);
export const msgUrl = i18n.msgUrl.bind(i18n);
export const msgJs = i18n.msgJs.bind(i18n);
