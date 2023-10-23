import utilities from '$lib/server/utilities';
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	
	const org = await utilities.findOne('orgs', {org_key: params.org_key});

	return json(org);
};