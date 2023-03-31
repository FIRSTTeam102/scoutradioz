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
	
	let bottomNavBar = document.getElementById('bottom-nav-bar');
	let bottomNavBarHeight = bottomNavBar ? bottomNavBar.getBoundingClientRect().height : 0;
	
	let windowWidth = window.innerWidth;
	let windowHeight = window.innerHeight;
	
	let availableWidth = windowWidth; // Maybe include the possibility of parentElem having margins later
	let availableHeight = windowHeight - parentRect.top - bottomNavBarHeight;
	
	return {
		width: availableWidth,
		height: availableHeight,
	}
}