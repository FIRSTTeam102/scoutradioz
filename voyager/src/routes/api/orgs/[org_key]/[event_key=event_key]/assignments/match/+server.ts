import utilities from '$lib/server/utilities';
import { error, json } from '@sveltejs/kit';
import type { MatchScouting, StringDict } from 'scoutradioz-types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, params }) => {
	const onlyAssigned = url.searchParams.get('onlyAssigned') !== null ? { assigned_scorer: { $ne: undefined } } : {};
	
	let st = performance.now();
	
	const event_key = params.event_key;
	const org_key = params.org_key;

	const currentEvent = await utilities.findOne('events',
		{ key: event_key },
		{ },
		{ }
	);
	
	if (!currentEvent) throw error(404, new Error(`Event ${event_key} not found`));
	if (!currentEvent.team_keys || currentEvent.team_keys.length === 0) throw error(500, new Error(`Event ${event_key} list of teams is 0`));
	
	const teamNames: StringDict = (await utilities.find('teams',
		{ 'key': { $in: currentEvent.team_keys } },
		{ projection: { _id: 0, key: 1, nickname: 1 }, sort: { team_number: 1 } },
		{ allowCache: true, maxCacheAge: 300 }
	)).reduce((obj: StringDict, item: typeof teamNames) => Object.assign(obj, { [item.key]: item.nickname }), {});
	
	let matchscouting = (await utilities.find('matchscouting', {
		org_key,
		event_key,
		...onlyAssigned
	}, {
		// limit: 60,
		sort: { time: 1, alliance: -1, team_key: 1 }
	}, { allowCache: true }
	));
	
	console.log(performance.now() - st);
	
	let all = matchscouting.map((match) => {
		return {
			...match,
			team_name: teamNames[match.team_key],
			synced: !!match.data, // 2023-11-8 JL: turn on synced boolean if there's data for this match on the server
		};
	});

	return json(all);
};