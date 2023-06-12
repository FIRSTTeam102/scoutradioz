import { error, json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/lucia';


export const GET: RequestHandler = async ({ params, request }) => {
	
	// JL note: not sure whether we want it to go to /org_key/home or just / to select an org
	// const destinationURL = '/';
	const destinationURL = `/${params.org_key}/home`;
	
	// try {
	// Attempt to retrieve session ID from headers
	const sessionId = auth.parseRequestHeaders({
		method: request.method,
		url: request.url,
		headers: {
			origin: request.headers.get('Origin'),
			cookie: request.headers.get('Cookie'),
		}
	});
	// If there is no user, then send them back to home
	if (!sessionId) {
		// throw redirect(302, `/${params.org_key}/home`);
		throw redirect(302, destinationURL);
	}
	
	// Now, invalidate the session (JL: If the session is already invalid or not found, it appears that the method does not throw)
	await auth.invalidateSession(sessionId);
	
	// Send the user back
	throw redirect(302, destinationURL);
};

// export const load = (async ({ request }) => {
	
	
// 	try {
// 		const sessionId = auth.parseRequestHeaders({
// 			method: request.method,
// 			url: request.url,
// 			headers: {
// 				origin: request.headers.get('Origin'),
// 				cookie: request.headers.get('Cookie'),
// 			}
// 		});
// 		console.log('Got session id', sessionId);
// 		// const session = await auth.validateSession(sessionId);
// 	}
// 	catch {
// 	// invalid request
// 	}
	
// 	// console.log('FOO', event.locals.auth.storedSessionId);
	
// 	// const authRequest = auth.handleRequest(event);
// 	// const session = await authRequest.validateUser();
	
// 	// console.log('authRequest', authRequest);
// 	// console.log('session', session);
	
// }) satisfies PageServerLoad;