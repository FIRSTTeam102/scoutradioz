import type { PageLoad } from './$types';
import type { MatchScouting } from 'scoutradioz-types';
import { event_key, getStore } from '$lib/stores';
import db from '$lib/localDB';

export const load: PageLoad = async ({ fetch }) => {
	// const all: (MatchScouting & { team_name: string })[] = await (await fetch('/api/assignments/match?onlyAssigned')).json();
	
	let all = await db.matchscouting
		.where('event_key').equals(getStore(event_key) || '')
		.toArray();
	
	let grouped: (typeof all)[] = Object.values(
		all.reduce((grouped: { [key: string]: any }, match) => {
			grouped[match.match_key] = grouped[match.match_key] || [];
			grouped[match.match_key].push(match);
			return grouped;
		}, {})
	).slice(0, 10);

	return { grouped };
};
