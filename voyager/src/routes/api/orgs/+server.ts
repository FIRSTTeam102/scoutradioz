import utilities from '$lib/server/utilities';
import { json } from '@sveltejs/kit';
import type { Org } from 'scoutradioz-types';
import type { FilterQueryTyped } from 'scoutradioz-utilities';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const orgKey = url.searchParams.get('org_key');
	const filter: FilterQueryTyped<Org> = {};
	if (orgKey) filter.org_key = orgKey;
	
	const orgs = await utilities.find('orgs', filter, {sort: {org_key: 1}});

	return json(orgs);
};