import type { PageLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutField } from '$lib/types';
import db from '$lib/localDB';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const { event_key, org_key, user_id, event } = await parent();
	if (!event) throw redirect(307, '/');

	const key = url.searchParams.get('key');
	if (!key) throw error(400, new Error('Match-team key not specified'));

	const team_key = key.split('_')[2];

	const layout = await db.layout
		.where({
			org_key,
			year: event.year,
			form_type: 'matchscouting'
		})
		.toArray();
	
	// TODO: multi org
	const matchScoutingEntry = await db.matchscouting
		.where('match_team_key').equals(key).first();
	
	if (!matchScoutingEntry) throw error(404, new Error(`Match scouting assignment not found for key ${key}!`));
	
	const team = await db.teams
		.where('key').equals(team_key).first();
	
	if (!team) throw error(404, new Error(`Team info not found for key ${team_key}!`));
	
	// This user's next scouting assignment.
	const nextAssignments = await db.matchscouting
		.where({event_key, org_key})
		.and(asg => 
			asg.match_number > matchScoutingEntry.match_number &&
			asg.assigned_scorer?.id === user_id,
		).sortBy('match_number');
	const nextAssignment = nextAssignments[0];
	
	// Whether their next assignment is the next match or if they have a break.
	const hasUpcomingBreak = (nextAssignment?.match_number === matchScoutingEntry.match_number + 1);
	
	console.warn('match/form +page.ts loading!');

	return { layout, key, team, matchScoutingEntry, nextAssignment, hasUpcomingBreak };
};
