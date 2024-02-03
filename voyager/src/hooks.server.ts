import { lucia } from '$lib/server/auth';
import type { Handle, RequestEvent } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event }: { error: Error; event: RequestEvent }): App.Error {
	const is404 = event.route.id === null;
	return {
		message: is404 ? 'Route not found' : error.message,
		name: is404 ? 'Not found' : error.name || 'Error',
		stack: error.stack?.replace(/ {4}/g, '\t')
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	console.log('hooks.server.ts running!');
	const sessionId = event.cookies.get(lucia.sessionCookieName);
	// If there's no session cookie
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		const sessionCookie = lucia.createSessionCookie(session.id);
		// sveltekit types deviate from the defacto standard
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	if (!session) {
		const sessionCookie = lucia.createBlankSessionCookie();
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	event.locals.user = user;
	event.locals.session = session;
	return resolve(event);
};

// JL: Without this, fetch calls won't be able to access error messages
if (!('toJSON' in Error.prototype))
	Object.defineProperty(Error.prototype, 'toJSON', {
		value: function () {
			const alt = {};

			Object.getOwnPropertyNames(this).forEach(function (key) {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				alt[key] = this[key];
			}, this);

			return alt;
		},
		configurable: true,
		writable: true
	});
