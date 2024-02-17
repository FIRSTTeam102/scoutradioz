import utilities from '$lib/server/utilities';
import { error, json } from '@sveltejs/kit';
import type { MatchScouting, StringDict } from 'scoutradioz-types';
import type { RequestHandler } from './$types';
import type { MatchScoutingLocal } from '$lib/localDB';
import { ObjectId, type AnyBulkWriteOperation } from 'mongodb';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let data = (await request.json()) as MatchScoutingLocal[];
	
	// TODO: (important) user authentication

	// JL note: I was writing this thing out and then realized that we don't (currently) want
	// 	to completely override the match scouting entries, we only want to update actual_scorer
	// 	and data. I'm just keeping this code commented out in case it comes in useful later,
	// 	when we can actually generate assignments locally on Voyager.
	// let dataToInsert: MatchScouting[] = [];
	// if (!Array.isArray(data)) throw error(400, new Error('data is not an array'));

	// for (let localMatch of data) {
	// 	const { year, event_key, org_key, match_key, match_number, time, alliance, team_key, match_team_key, assigned_scorer, actual_scorer, data, } = localMatch;
	// 	let newMatch: MatchScouting = {
	// 		year,
	// 		event_key,
	// 		org_key,
	// 		match_key,
	// 		match_number,
	// 		time,
	// 		alliance,
	// 		team_key,
	// 		match_team_key,
	// 		data,
	// 	};
	// 	if (actual_scorer) {
	// 		newMatch.actual_scorer = {
	// 			id: new ObjectId(actual_scorer.id),
	// 			name: actual_scorer.name
	// 		};
	// 	}
	// 	if (assigned_scorer)
	// }

	let bulkWriteOp: AnyBulkWriteOperation<MatchScouting>[] = [];

	for (let localMatch of data) {
		// TODO: verify that the user has access to push data for this org
		const { event_key, org_key, actual_scorer, data, match_team_key } = localMatch;
		if (actual_scorer) {
			bulkWriteOp.push({
				updateOne: {
					filter: { match_team_key, event_key, org_key },
					update: {
						$set: {
							actual_scorer: {
								id: new ObjectId(actual_scorer.id),
								name: actual_scorer.name
							}
						}
					}
				}
			});
		}
		bulkWriteOp.push({
			updateOne: {
				filter: { match_team_key, event_key, org_key },
				update: {
					$set: { data }
				}
			}
		});
		// TODO: parse useragent and save that too
		// 	look into node package ua-parser-js. ip can be found with getClientAddress() and useragent string can be found with request.headers.get('user-agent')
	}
	let writeResult = await utilities.bulkWrite('matchscouting', bulkWriteOp);
	
	return json(writeResult);
};

export const GET: RequestHandler = async ({ url, params }) => {
	const onlyAssigned =
		url.searchParams.get('onlyAssigned') !== null ? { assigned_scorer: { $ne: undefined } } : {};

	let st = performance.now();

	const event_key = params.event_key;
	const org_key = params.org_key;

	const currentEvent = await utilities.findOne('events', { key: event_key }, {}, {});

	if (!currentEvent) throw error(404, new Error(`Event ${event_key} not found`));
	if (!currentEvent.team_keys || currentEvent.team_keys.length === 0)
		throw error(500, new Error(`Event ${event_key} list of teams is 0`));

	const teamNames: StringDict = (
		await utilities.find(
			'teams',
			{ key: { $in: currentEvent.team_keys } },
			{ projection: { _id: 0, key: 1, nickname: 1 }, sort: { team_number: 1 } },
			{ allowCache: true, maxCacheAge: 300 }
		)
	).reduce(
		(obj: StringDict, item: typeof teamNames) => Object.assign(obj, { [item.key]: item.nickname }),
		{}
	);

	let matchscouting = await utilities.find(
		'matchscouting',
		{
			org_key,
			event_key,
			...onlyAssigned
		},
		{
			// limit: 60,
			sort: { time: 1, alliance: -1, team_key: 1 }
		},
		{ allowCache: true }
	);

	console.log(performance.now() - st);

	let all = matchscouting.map((match) => {
		return {
			...match,
			team_name: teamNames[match.team_key]
		};
	});

	return json(all);
};
