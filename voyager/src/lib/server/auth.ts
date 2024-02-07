import { dev } from '$app/environment';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '$env/static/private';
import { GitHub } from 'arctic';
import { Lucia, TimeSpan } from 'lucia';
import { generateRandomString } from 'oslo/crypto';
import type { User } from 'scoutradioz-types';
import LuciaAdapter from './LuciaAdapter';

export const github = new GitHub(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET);

const adapter = new LuciaAdapter(); // your adapter

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			// set to `true` when using HTTPS
			secure: !dev
		},
		name: 'LuciaSessionCookie',
	},
	sessionExpiresIn: new TimeSpan(30, 'd'), // 30 days
	getUserAttributes: (attributes: DatabaseUserAttributes) => {
		let ret = { ...attributes };
		// @ts-ignore
		delete ret.password;
		// @ts-ignore
		delete ret._id;
		// @ts-ignore
		delete ret.push_subscription;
		return ret;
	},
	getSessionAttributes: (attributes: DatabaseSessionAttributes) => {
		return {
			...attributes
		};
	}
});

/**
 * Creates a MongoDb ObjectId-friendly unique id,
 * but using crypto API (as recommended by lucia) instead of
 * Mongo's default ObjectId strategy, which is not crypto-safe.
 */
export function createSessionId() {
	return generateRandomString(24, '0123456789abcdef');
}

declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
	}
}

declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		DatabaseSessionAttributes: DatabaseSessionAttributes;
		DatabaseUserAttributes: DatabaseUserAttributes;
	}
}
interface DatabaseSessionAttributes {
	githubId?: string;
}
type DatabaseUserAttributes = {
	[key in Exclude<keyof User, '_id' | 'password' | 'push_subscription'>]: User[key];
};
