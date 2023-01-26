import utilities from '$lib/server/utilities';
import { org_key, event_key, getStore } from '$lib/stores';
import type { MatchScouting, StringDict } from '@firstteam102/scoutradioz-types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const onlyAssigned = url.searchParams.get('onlyAssigned') !== null ? { assigned_scorer: { $ne: undefined } } : {};
	
	let st = performance.now();

	const currentEvent = await utilities.findOne('events',
		{ key: getStore(event_key) },
		{ projection: { team_keys: 1 } },
		{ allowCache: true, maxCacheAge: 300 }
	);
	const teamNames: StringDict = (await utilities.find('teams',
		{ 'key': { $in: currentEvent.team_keys } },
		{ projection: { _id: 0, key: 1, nickname: 1 }, sort: { team_number: 1 } },
		{ allowCache: true, maxCacheAge: 300 }
	)).reduce((obj: StringDict, item: typeof teamNames) => Object.assign(obj, { [item.key]: item.nickname }), {});
	
	
	let matchscouting = (await utilities.find('matchscouting', {
		org_key: getStore(org_key),
		event_key: getStore(event_key),
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
			team_name: teamNames[match.team_key]
		};
	});

	return new Response(JSON.stringify(all), {
		headers: {
			'content-type': 'application/json'
		}
	});
};