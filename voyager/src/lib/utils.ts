import { redirect } from '@sveltejs/kit';
import { sha1 } from 'oslo/crypto';
import type { ScouterHistoryRecord } from 'scoutradioz-types';
import { getContext, onDestroy, onMount } from 'svelte';
import { alertStore } from './stores';
import { type DialogContext, type RefreshButtonAnimationContext, type RefreshContext, type SnackbarContext, type TitleContext } from './types';

export class HttpError extends Error {
	status: number;
	body: any;
	constructor(status: number, message?: string, body?: any) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

/**
 * Sends a fetch request to the specified URL.
 * @param url URL to fetch
 * @param options Options to pass to the HTTP fetch API
 * @returns response
 */
export async function fetchJSON<T = any>(url: string, options?: RequestInit): Promise<T> {
	let response = await fetch(url, options);

	let json = await response.json();
	if (response.ok)
		return json;
	else
		throw new HttpError(response.status, json['message'] || response.statusText);
}

/**
 * Sends an AJAX POST request to the specified url, using the HTTP fetch API.
 * 
 * Shorthand for:
 * 
 * 		fetchJSON(url, {
 * 			method: 'POST',
 * 			headers: {
 * 				'Content-Type': 'application/json',
 * 			},
 * 			body: JSON.stringify(data)
 * 		});
 */
export async function postJSON<T = any>(url: string, body: any, options?: RequestInit): Promise<T> {
	if (!options) options = {};
	options.method = 'POST';
	// just in case they wanna provide other headers, merge existing headers object with the content-type default thing
	let jsonHeader = { 'Content-Type': 'application/json' };
	if (options.headers) options.headers = {
		...options.headers,
		...jsonHeader,
	};
	else options.headers = jsonHeader;
	options.body = JSON.stringify(body);
	
	return fetchJSON<T>(url, options);
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

/**
 * Since `comp_level` isn't saved in the matchscouting table, this function takes the match key and returns the comp_level,
 * e.g. 'qm', 'qf', etc.
 */
export function matchKeyToCompLevel(key: string) {
	let matchIdentifier = key.split('_')[1];
	return matchIdentifier.substring(0, 2);
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
		el = el?.parentElement;
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

// CLONED IN PRIMARY/SRC/ROUTES/SCOUTING.TS
// IF THIS FUNCTION CHANGES, CHANGE IT IN THAT PLACE TOO
export function getNewSubmissionHistory<T extends {history?: ScouterHistoryRecord[]}>(assignment: T, user_id: number, user_name: string) {
	let newRecord: ScouterHistoryRecord = {
		id: user_id,
		name: user_name,
		time: new Date(),
	};

	if (!assignment.history) return [newRecord]; // If there's no history, we don't need to do any shenanigans

	let history = [...assignment.history]; // Create a clone of the original history object
	let lastEntry = history[history.length - 1];
	// If this is an edit by the same person who made the last change, then replace the record
	if (lastEntry.id === user_id) {
		history[history.length - 1] = newRecord;
	}
	// if the last edit was done by someone else, then add a new entry to the stack
	else {
		history.push(newRecord);
	}
	return history;
}

/**
 * JL: Made this cuz I hate copy-pasted boilerplate and I'm SHOCKED that this actually works.
 * This method returns all of the "getContext"able items from +layout.svelte.
 * It MUST be called during component initialization, i.e. in the main scope of a
 * svelte file's script tag.
 */
export function getPageLayoutContexts() {
	const snackbar = getContext('snackbar') as SnackbarContext;
	const refreshButton = getContext('refreshButton') as RefreshContext;
	const refreshButtonAnimation = getContext(
		'refreshButtonAnimation'
	) as RefreshButtonAnimationContext;
	const dialog = getContext('dialog') as DialogContext;
	return { snackbar, refreshButton, refreshButtonAnimation, dialog };
}

/**
 * JL: Made this cuz I hate copy-pasted boilerplate and I am EVEN MORE SHOCKED that this one also works.
 * This method auto adds refresh button functionality on the given page and removes it on onDestroy.
 * Provide the onClick handler for the refresh button.
 */
export function addRefreshButtonFunctionality(clickHandler?: () => any, tooltip?: string) {
	const refreshButton = getContext('refreshButton') as RefreshContext;
	onMount(() => {
		refreshButton.set({
			supported: true,
			onClick: clickHandler,
			tooltip,
		});
	});
	onDestroy(() => {
		refreshButton.set({supported: false});
	});
}

/**
 * Sets the current page title and automatically unsets when the page is destroyed
 */
export function setPageTitle(title: string, subtitle?: string) {
	const titleContext = getContext<TitleContext>('title');
	const subtitleContext = getContext<TitleContext>('subtitle');
	titleContext.set(title);
	subtitleContext.set(subtitle || '');
	onMount(() => {
	});
	onDestroy(() => {
		titleContext.set('');
		subtitleContext.set('');
	});
}

// Taken from oslo (These functions are not exported in the node package)
function byteToBinary(byte: number) {
	return byte.toString(2).padStart(8, '0');
}
function bytesToBinary(bytes: Uint8Array) {
	return [...bytes].map((val) => byteToBinary(val)).join('');
}
function binaryToInteger(bits: string) {
	return parseInt(bits, 2);
}

/** Encode a string with a custom base-32 alphabet, omitting I, 1, O, and 0 for readability */
export async function base32Hash(data: string) {
	let st = performance.now();
	// Tweak of oslo's encodeBase32 function with a different alphabet
	const encoded = new TextEncoder().encode(data);
	const hash = await sha1(encoded);
	const bits = bytesToBinary(new Uint8Array(hash));
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let result = '';
	for (let i = 0; i < Math.ceil(bits.length / 5); i++) {
		const key = binaryToInteger(bits.slice(i * 5, (i+1) * 5).padEnd(5, '0'));
		const val = alphabet[key];
		result += val;
	}
	return result;
}

export function redirectWithAlert(path: string, message: string, type?: 'info'|'success'|'warn'|'error') {
	if (!type) type = 'info';
	alertStore.set({
		message,
		type
	});
	return redirect(307, path);
}