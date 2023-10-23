import utilities from '$lib/server/utilities';
import type { Team, TeamSimple } from 'scoutradioz-types';
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	
	const teams = await utilities.find('teams', {}, {
		projection: {
			city: 1,
			country: 1,
			key: 1,
			name: 1,
			nickname: 1,
			state_prov: 1,
			team_number: 1,
		}
	});
	
	return json(teams);
};