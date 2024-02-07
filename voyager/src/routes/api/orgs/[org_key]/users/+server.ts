import type { LightUser } from '$lib/localDB';
import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	validateUserOrg(locals, params.org_key);

	const users: LightUser[] = await utilities.find(
		'users',
		{ org_key: params.org_key, visible: true },
		{
			projection: {
				_id: 1,
				org_key: 1,
				name: 1,
				role_key: 1,
				event_info: 1
			}
		},
		{ allowCache: true }
	);

	return json(users);
};
