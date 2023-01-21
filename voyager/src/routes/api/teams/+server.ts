import utilities from '$lib/server/utilities';
import type { Team } from '@firstteam102/scoutradioz-types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const org_key = url.searchParams.get('org_key');
	const filter = org_key ? { org_key } : {};
	
	const teams: Team[] = await utilities.aggregate('teams', [
		{$sample: {size: 20}}
	])

	return new Response(JSON.stringify(teams), {
		headers: {
			'content-type': 'application/json'
		}
	});
};