import type { PageLoad } from './$types';
import { event_key, getStore, org_key, whenStoresLoaded } from '$lib/stores';
import db from '$lib/localDB';

export const load: PageLoad = async ({ fetch }) => {
	// const all: (MatchScouting & { team_name: string })[] = await (await fetch('/api/assignments/match?onlyAssigned')).json();
	await whenStoresLoaded();
	let all = await db.matchscouting
		.where({
			event_key: getStore(event_key),
			org_key: getStore(org_key),
		})
		.toArray();

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

	return { grouped };
};
