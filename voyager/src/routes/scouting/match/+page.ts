import type { PageLoad } from './$types';
import { event_key, getStore, org_key, storesLoaded, } from '$lib/stores';
import db from '$lib/localDB';
import { requireStores } from '$lib/utils';

export const load: PageLoad = async ({ fetch }) => {
	await requireStores(event_key, org_key);
	
	// JL: super hacky temporary thing to mark current match number
	let firstMatchNumber: number = parseInt(localStorage.getItem(`match_number_${getStore(event_key)}`) || '1');

	let all = await db.matchscouting
		.where({
			event_key: getStore(event_key),
			org_key: getStore(org_key),
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
