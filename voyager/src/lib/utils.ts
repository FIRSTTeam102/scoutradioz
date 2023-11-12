export class HttpError extends Error {
	status: number;
	body: any;
	constructor(status: number, message?: string, body?: any) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

export async function fetchJSON<T = any>(url: string, options?: RequestInit): Promise<T> {
	let response = await fetch(url, options);

	let json = await response.json();
	if (response.ok)
		return json;
	else
		throw new HttpError(response.status, json['message'] || response.statusText);
}

type hasTeamKey = AnyDict & {
	team_key: string;
}
/**
 * JS {@link Array.prototype.sort} compareFn to sort an array which contains objects who have a `team_key` field, by comparing their numbers.
 */
export function sortWithTeamKeyByNumber(a: hasTeamKey, b: hasTeamKey) {
	return parseInt(a.team_key.substring(3)) - parseInt(b.team_key.substring(3));
}

/** Retrieves the desired width and height of an element which wishes to take up the entire space of the screen EXCLUDING what is above it and the bottom nav bar. */
export function getAvailableWindowSize(parentElem: HTMLElement) {
	let parentRect = parentElem.getBoundingClientRect();

	// Get element's y position without accounting for transforms,
	// 	because the sliding tabs fly transition applies a y transform
	let offsetTop = 0;
	let el: HTMLElement | null | undefined = parentElem;
	do {
		offsetTop += el.offsetTop;
		el = el?.parentElement
	} while (el);

	let bottomNavBar = document.getElementById('bottom-nav-bar');
	let bottomNavBarHeight = bottomNavBar ? bottomNavBar.getBoundingClientRect().height : 0;

	let windowWidth = window.innerWidth;
	let windowHeight = window.innerHeight;

	let availableWidth = windowWidth; // Maybe include the possibility of parentElem having margins later
	let availableHeight = windowHeight - offsetTop - bottomNavBarHeight;
	// let availableHeight = windowHeight - parentRect.top - bottomNavBarHeight;

	return {
		width: availableWidth,
		height: availableHeight,
	};
}

/**
 * Simple calculator to generate a numeric hash from a given string
 * @param string the string to be hashed
 * @returns a numeric value representing the string hash
 */
export function simpleStringToHash(string: string) {
	let hash = 0;
	if (string.length == 0) return hash;

	for (let i = 0; i < string.length; i++) {
		let char = string.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}

	return hash;
}

/**
 * Generate a checksum for a given string. The same string will give
 * the same checksum, but any change to the string will give a different
 * checksum. For our purposes, we only need a few characters to have
 * a reasonably negligible chance of a clash.
 */
export async function getStringChecksum(string: string) {
	const CHECKSUM_LENGTH = 10; // 10 hex characters has a 1 in a trillion chance of a clash
	const encoder = new TextEncoder();
	const byteArray = encoder.encode(string);
	const arrayBuffer = await crypto.subtle.digest('SHA-1', byteArray);
	return arrayBufferHashToString(arrayBuffer).substring(0, CHECKSUM_LENGTH);
}

function arrayBufferHashToString(arrayBuffer: ArrayBuffer) {
	const uint8View = new Uint8Array(arrayBuffer);
	return Array.from(uint8View)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Updates a simple hash with an additional value
 * @param hash the current value of the hash
 * @param nextValue the next number to be included in the hash 
 * @returns an updated hash value
 */
export function updateSimpleHash(hash: number, nextValue: number) {
	let h2 = ((hash << 5) - hash) + nextValue;
	h2 = h2 & h2;
	return h2;
}
