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