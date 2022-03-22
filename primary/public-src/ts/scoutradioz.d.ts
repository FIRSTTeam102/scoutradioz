/// <reference path="../ts-bundled/FormSubmission.ts"/>
/// <reference path="../ts-bundled/NotificationCard.ts"/>

declare class Cookies {
	static get(key: string): any;
	static set(key: string, value: any, value2?: any): any;
	static remove(key: string): any;
}

declare function debugToHTML(message: any): void;
declare function assert(condition: boolean, message: any): void;
/**
 * Handle resize events reasonably, i.e. with a few ms delay, to avoid significant performance overhead.
 * @param cb Callback
 */
declare function onResize(cb: Function): void;
/**
 * Bring the element of a specified ID into view, smoothly.
 * @param id ID of element to scroll to.
 */
declare function scrollToId(id: string): void;

// /**
//  * @override (parseInt allows undefined, so TypeScript should too )
//  * Converts a string to an integer.
//  * @param string — A string to convert into a number.
//  * @param radix — A value between 2 and 36 that specifies the base of the number in string. If this argument is not supplied, strings with a prefix of '0x' are considered hexadecimal. All other strings are considered decimal.
//  */
// declare function parseInt(string: string | undefined, radix?: number | undefined): number