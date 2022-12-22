import type { PageLoad } from './$types';
import type { MatchScouting } from '@firstteam102/scoutradioz-types';

export const load: PageLoad = async ({ fetch }) => {
	const all: (MatchScouting & { team_name: string })[] = await (await fetch('/api/assignments/match?onlyAssigned')).json();

	let grouped: (typeof all)[] = Object.values(
		all.reduce((grouped: { [key: string]: any }, match) => {
			grouped[match.match_key] = grouped[match.match_key] || [];
			grouped[match.match_key].push(match);
			return grouped;
		}, {})
	);

	return { grouped };
};
