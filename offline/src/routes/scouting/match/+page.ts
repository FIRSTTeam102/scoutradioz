import type { PageLoad } from './$types';
import type { MatchScouting, TeamKey } from '@firstteam102/scoutradioz-types';

import matchScouting from './dummyMatchScouting.json'; // todo: add api call

export const load: PageLoad = async () => {
	let all = matchScouting as unknown as MatchScouting[];

	let grouped: MatchScouting[][] = Object.values(
		all.reduce((grouped: { [key: string]: any }, match) => {
			grouped[match.match_key] = grouped[match.match_key] || [];
			grouped[match.match_key].push(match);
			return grouped;
		}, {})
	);

	return { grouped };
};
