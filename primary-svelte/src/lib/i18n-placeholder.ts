/**
 * Placeholder functions for i18n support
 */

function placeholder(key: string, ...args: unknown[]) {
	return '[' + key + ']';
}

export const msg = placeholder;
export const msgMarked = placeholder;
export const msgUrl = placeholder;
export const getLocales = (...args: unknown[]) => [];
export const getLocaleName = (...args: unknown[]) => '';
export const getLocaleDirection = (...args: unknown[]) => 'ltr';