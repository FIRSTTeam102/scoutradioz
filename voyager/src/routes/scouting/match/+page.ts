import type { PageLoad } from './$types';
import db from '$lib/localDB';

export const load: PageLoad = async ({ fetch, parent }) => {
	const { event_key, org_key } = await parent();
	
	// JL: super hacky temporary thing to mark current match number
	let firstMatchNumber: number = parseInt(localStorage.getItem(`match_number_${event_key}`) || '1');

	let all = await db.matchscouting
		.where({
			event_key,
			org_key,
		})
		.and(match => match.match_number >= firstMatchNumber)
		.sortBy('match_number');

	let grouped: (typeof all)[] = Object.values(
		all.reduce((grouped: { [key: string]: any }, match) => {
			grouped[match.match_key] = grouped[match.match_key] || [];
			grouped[match.match_key].push(match);
			return grouped;
		}, {})
	).slice(0, 10);
	
	// Make red alliance appear first 
	// TODO: Maybe use the real red1, red2, etc. order from the matches table, but that would require sending that order in the qr code
	grouped.forEach(group =>
		group.sort((a, b) => b.alliance.localeCompare(a.alliance))
	);

	return { grouped, firstMatchNumber };
};
