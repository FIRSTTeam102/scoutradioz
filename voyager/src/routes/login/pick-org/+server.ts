import type { LightUser, OrgLocal } from '$lib/localDB';
import { createSessionId, lucia } from '$lib/server/auth';
import utilities from '$lib/server/utilities';
import { error, json, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { Bcrypt } from 'oslo/password';

const bcrypt = new Bcrypt();

export async function POST(event: RequestEvent): Promise<Response> {
	const { org_key, org_password } = await event.request.json();
	
	// Find org
	const org = await utilities.findOne('orgs', 
		{org_key}, 
		{}, 
		{allowCache: true}
	);
	
	// Check password
	const passwordValid = await bcrypt.verify(org.default_password, org_password);
	if (!passwordValid) throw error(401, new Error('Password invalid.'));
	
	// find default user
	const defaultUser = await utilities.findOne('users',
		{org_key, name: 'default_user', visible: false},
		{}, 
		{allowCache: true}
	);
	if (!defaultUser) throw error(500, new Error(`Couldn't find default_user in db for org ${org_key}!`));
	
	// and log em in!
	const sessionId = createSessionId();
	console.log(sessionId, new ObjectId());
	const session = await lucia.createSession(String(defaultUser._id), {}, {sessionId});
	const sessionCookie = lucia.createSessionCookie(session.id);
	event.cookies.set(sessionCookie.name, sessionCookie.value, {
		path: '.',
		...sessionCookie.attributes,
	});
	
	return json({
		user: {
			_id: defaultUser._id,
			org_key: defaultUser.org_key,
			name: defaultUser.name,
			role_key: defaultUser.role_key,
			event_info: defaultUser.event_info,
		} as LightUser,
		org: {
			...org,
			_id: String(org._id),
			default_password: undefined,
		} as OrgLocal,
	});
}