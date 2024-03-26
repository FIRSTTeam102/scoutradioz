import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';
import { error } from '@sveltejs/kit';
import db from '$lib/localDB';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const { event_key, org_key, event } = await parent();

	const team_key = url.searchParams.get('key');
	const teamNumber = Number(team_key?.replace('frc', ''));

	if (!team_key || !teamNumber) throw error(404, new Error('Team key is either not defined or invalid'));
	if (!event) throw error(404, new Error('Event not found'));

	const layout = await db.layout
		.where({
			org_key,
			year: event.year,
			form_type: 'pitscouting'
		})
		.toArray();

	const pitScoutingEntry = await db.pitscouting
		.where({
			org_key,
			event_key,
			team_key
		})
		.first();

	if (!pitScoutingEntry)
		throw error(404, new Error(`Pit scouting assignment not found for key ${team_key} at event ${event_key}`));

	const team = await db.teams
		.where({
			key: team_key
		})
		.first();

	if (!team) throw error(404, new Error(`Team ${team_key} not found`));

	return { layout, key: team_key, teamNumber, pitScoutingEntry, team };
};
