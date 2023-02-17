import utilities from '$lib/server/utilities';
// import type { User } from 'scoutradioz-types';
import type { LightUser } from '$lib/localDB';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const org_key = url.searchParams.get('org_key');
	const filter = org_key ? { org_key } : {};

	const users: LightUser[] = await utilities.find('users', filter, {
		projection: {
			_id: 1,
			org_key: 1,
			name: 1,
			role_key: 1,
			event_info: 1
		}
	}, { allowCache: true });

	return new Response(JSON.stringify(users), {
		headers: {
			'content-type': 'application/json'
		}
	});
};