import utilities from '$lib/server/utilities';
// import type { User } from 'scoutradioz-types';
import type { LightUser } from '$lib/localDB';
import type { RequestHandler } from './$types';
import { getStore, org_key } from '$lib/stores';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, params }) => {

	console.log(org_key, getStore(org_key));
	
	const users: LightUser[] = await utilities.find('users', {
		org_key: getStore(org_key),
	}, {
		projection: {
			_id: 1,
			org_key: 1,
			name: 1,
			role_key: 1,
			event_info: 1
		}
	}, { allowCache: true });

	return json(users);
};