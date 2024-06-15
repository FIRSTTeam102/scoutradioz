import type { PageLoad } from './$types';
import db from '$lib/localDB';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const { event_key, org_key, user_id } = await parent();

	// JL: haven't implemented a control for this yet but i figured we might as well have it ready
	const maxNumMatches = Number(url.searchParams.get('n')) || 10; 
	
	// JL: super hacky temporary thing to mark current match number
	let firstMatchNumber: number = parseInt(localStorage.getItem(`match_number_${event_key}`) || '1');

	let assignments = await db.matchscouting
		.where({
			event_key,
			org_key,
		})
		.and(match => match.match_number >= firstMatchNumber)
		.sortBy('match_number');

	let grouped: (typeof assignments)[] = Object.values(
		assignments.reduce((grouped: { [key: string]: any }, match) => {
			grouped[match.match_key] = grouped[match.match_key] || [];
			grouped[match.match_key].push(match);
			return grouped;
		}, {})
	);
	
	// Make red alliance appear first 
	// TODO: Maybe use the real red1, red2, etc. order from the matches table, but that would require sending that order in the qr code
	grouped.forEach(group =>
		group.sort((a, b) => b.alliance.localeCompare(a.alliance))
	);
	
	const myMatches = grouped.filter(match =>
		match.some(asg => asg.assigned_scorer?.id === user_id)
	).slice(0, maxNumMatches);

	const myTeams = myMatches.map(match =>
		match.filter(asg => asg.assigned_scorer?.id === user_id)
	);
	
	const allMatches = grouped.slice(0, maxNumMatches);
	
	const syncStatus = await db.syncstatus.where({
		table: 'matchscouting',
		filter: `org=${org_key},event=${event_key}`
	}).first();
	
	if (!syncStatus || (typeof syncStatus.data?.checksum !== 'string')) {
		throw error(404, new Error('Match scouting schedule information not found!'));
	}
	let checksum = syncStatus.data.checksum.substring(0, 3) as string;

	console.log('Assignments:', assignments);
	console.log('Grouped:', grouped);
	console.log('My Matches:', myMatches);
	console.log('My Team Matches:', myTeams);
	console.log('User ID', user_id);
	return { myMatches, myTeams, allMatches, firstMatchNumber, checksum };

};
