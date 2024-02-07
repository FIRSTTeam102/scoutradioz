import { lucia } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// This route should log out the user
export const load: PageServerLoad = async (event) => {
	console.log('switch-org server side route begin');
	const sessionId = event.cookies.get(lucia.sessionCookieName);
	// TODO later: instead of throwing an error, just redirect, maybe with a message
	// 	While in development, silent redirects to / may be counterproductive/confusing
	if (!sessionId) {
		console.error('switch-org: Session token not found!');
		throw error(401, new Error('You are not signed in'));
	}
	// Invalidate the session to log the user out
	await lucia.invalidateSession(sessionId);
};