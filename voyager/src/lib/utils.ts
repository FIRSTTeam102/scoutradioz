// JL note: might wanna rename this module name

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