import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	validateUserOrg(locals, params.org_key);
	
	const org = await utilities.findOne('orgs', 
		{org_key: params.org_key}, 
		{projection: {_id: 0}},
		{allowCache: true}
	);

	return json(org);
};