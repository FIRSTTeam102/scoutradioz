// JL note: might wanna rename this module name

import type { AnyDict } from "scoutradioz-types";

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
		throw new HttpError(response.status, response.statusText, json);
}

/** Send a POST request with a certain body. */
export async function postAndFetchJSON<T = any>(url: string, body: AnyDict): Promise<T> {
	return await fetchJSON(url, {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
}

export function isHttpError(err: unknown): err is HttpError {
	return err instanceof Error && 'body' in err;
}