import utilities from '$lib/server/utilities';
import { json } from '@sveltejs/kit';
import type { Org } from 'scoutradioz-types';
import type { FilterQueryTyped } from 'scoutradioz-utilities';
import type { RequestHandler } from './$types';
import type { LightOrg } from '$lib/localDB';

export const GET: RequestHandler = async ({ url }) => {
	const orgKey = url.searchParams.get('org_key');
	const filter: FilterQueryTyped<Org> = {};
	if (orgKey) filter.org_key = orgKey;

	const orgs = await utilities.find('orgs', filter, {
		sort: { org_key: 1 },
		projection: {
			org_key: 1,
			nickname: 1,
			team_number: 1,
			team_numbers: 1,
			team_key: 1,
			tema_keys: 1,
			event_keys: 1
		}
	}) as LightOrg[];

	return json(orgs);
};
