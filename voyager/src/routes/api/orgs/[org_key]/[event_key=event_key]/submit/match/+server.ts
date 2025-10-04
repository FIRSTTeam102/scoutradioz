import type { MatchScoutingLocal } from '$lib/localDB';
import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import { error, json } from '@sveltejs/kit';
import { type AnyBulkWriteOperation } from 'mongodb';
import type { MatchScouting, StringDict } from 'scoutradioz-types';
import type { RequestHandler } from './$types';
import httpAssert from '$lib/httpAssert';
import * as helpers from 'scoutradioz-helpers';
// @ts-ignore
const matchDataHelper = helpers.default.matchData;

matchDataHelper.config(utilities);

export const POST: RequestHandler = async ({
	request,
	params,
	locals,
	cookies,
	getClientAddress
}) => {
	validateUserOrg(locals, params.org_key);
	let data = (await request.json()) as MatchScoutingLocal[];
	httpAssert(Array.isArray(data), 400, 'Submitted data is not an array');

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

	const event = await utilities.findOne(
		'events',
		{ key: params.event_key },
		{},
		{ allowCache: true }
	);
	httpAssert(event, 404, `Event ${params.event_key} not found`);

	// const layout = await utilities.find(
	// 	'layout',
	// 	{ org_key: params.org_key, year: event.year, form_type: 'matchscouting' },
	// 	{ sort: { order: 1 } },
	// 	{ allowCache: true }
	// );
	
	const schema = await matchDataHelper.getSchemaForOrgAndEvent(params.org_key, event.key, 'matchscouting');
	const { layout } = schema;

	// Cache the type of each item in the layout for type checking/conversions
	let layoutTypeById: StringDict = {};
	for (let layoutItem of layout) {
		if ('id' in layoutItem) {
			console.debug(`${layoutItem.id} is a ${layoutItem.type}`);
			layoutTypeById[layoutItem.id] = layoutItem.type;
		}
	}

	console.log(
		`User ${locals.user?.name} from ${params.org_key} is submitting data from the following ${data.length} matches: `,
		data.map((match) => match.match_number).join(',')
	);

	for (let localMatch of data) {
		let { event_key, org_key, actual_scorer, data, match_team_key, history } = localMatch;
		if (!data) {
			console.warn(`Match ${localMatch.match_team_key} does not have data in submission; ignoring and keeping data`);
			continue;
		}
		// Verify authorization - params.org_key has been validated at the top of this route
		httpAssert(
			org_key === params.org_key,
			401,
			`You are authorized on org ${params.org_key} but you attempted to submit data for org ${org_key}!`
		);
		
		console.debug('data(pre-modified)=', JSON.stringify(data));

		for (let property in data) {
			console.debug(property);
			if (layoutTypeById.hasOwnProperty(property)) {
				data[property] = matchDataHelper.fixDatumType(data[property], layoutTypeById[property]);
			}
			// TODO later: Reject submissions from devices with outdated JSON layout, but then we need to give them a way to fix that client-side
			else console.warn(`Match has unexpected property ${property}!`);
		}
		console.debug('data(UPDATED:1)=', JSON.stringify(data));
		console.log(matchDataHelper.fixDatumType, matchDataHelper.calculateDerivedMetrics);
		let { matchData } = await matchDataHelper.calculateDerivedMetrics(org_key, event.year, data);
		data = matchData;
		console.debug('data(UPDATED:2)=', JSON.stringify(data));

		if (actual_scorer) {
			if (isNaN(actual_scorer.id) || typeof actual_scorer.id !== 'number') {
				console.log(
					`ERROR: actual_scorer.id is not a number! actual_scorer=${JSON.stringify(
						actual_scorer
					)}, localMatch=${JSON.stringify(localMatch)}`
				);
				throw error(400, new Error('actual_scorer.id is not a number!'));
			}
			bulkWriteOp.push({
				updateOne: {
					filter: { match_team_key, event_key, org_key },
					update: {
						$set: {
							actual_scorer: {
								id: actual_scorer.id,
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
					$set: { data, history }
				}
			}
		});
		// TODO: parse useragent and save that too
		// 	look into node package ua-parser-js. ip can be found with getClientAddress() and useragent string can be found with request.headers.get('user-agent')
	}
	let writeResult = await utilities.bulkWrite('matchscouting', bulkWriteOp);

	return json(writeResult);
};
