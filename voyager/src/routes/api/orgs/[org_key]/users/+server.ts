import utilities from '$lib/server/utilities';
import type { LightUser } from '$lib/localDB';
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {

	const users: LightUser[] = await utilities.find('users', {
		org_key: params.org_key
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