import { createSessionId, github, lucia } from '$lib/server/auth';
import { OAuth2RequestError } from 'arctic';
import { generateId } from 'lucia';
import utilities from '$lib/server/utilities';

import type { RequestEvent } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { generateRandomString } from 'oslo/crypto';

export async function GET(event: RequestEvent): Promise<Response> {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const storedState = event.cookies.get('github_oauth_state') ?? null;
	if (!code || !state || !storedState || state !== storedState) {
		return new Response(null, {
			status: 400
		});
	}

	try {
		const tokens = await github.validateAuthorizationCode(code);
		const githubUserResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${tokens.accessToken}`
			}
		});
		const githubUser: GitHubUser = await githubUserResponse.json();
		const existingUser = await utilities.findOne('users', { 'oauth.github_id': githubUser.id });

		if (existingUser) {
			const session = await lucia.createSession(String(existingUser._id), {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
			return new Response(null, {
				status: 302,
				headers: {
					Location: '/'
				}
			});
		} else {
			const sessionId = createSessionId();
			console.log(sessionId, sessionId.length);
			const session = await lucia.createSession('', { githubId: githubUser.id }, {sessionId});
			const sessionCookie = lucia.createSessionCookie(sessionId);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
			return new Response(null, {
				status: 302,
				headers: {
					Location: '/'
				}
			});
		}
	} catch (e) {
		// the specific error message depends on the provider
		if (e instanceof OAuth2RequestError) {
			// invalid code
			return new Response(null, {
				status: 400
			});
		}
		return new Response(null, {
			status: 500
		});
	}
}

interface GitHubUser {
	id: string;
	login: string;
}
