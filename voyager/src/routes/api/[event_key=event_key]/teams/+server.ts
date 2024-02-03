import utilities from '$lib/server/utilities';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * List of teams at the specified event.
 */
export const GET: RequestHandler = async ({ params }) => {
	const event = await utilities.findOne('events', {key: params.event_key});
	if (!event) throw error(404, new Error(`Event ${params.event_key} not found`));
	
	const teams = await utilities.find('teams', 
		{key: {$in: event.team_keys}}, 
		{projection: {
			city: 1,
			country: 1,
			key: 1,
			name: 1,
			nickname: 1,
			state_prov: 1,
			team_number: 1,
		}});
	
	return json(teams);
};