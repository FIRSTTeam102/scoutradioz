import utilities from '$lib/server/utilities';
import { error, json } from '@sveltejs/kit';
import type { Match } from 'scoutradioz-types';
import type { FilterQueryTyped } from 'scoutradioz-utilities';
import type { RequestHandler } from './$types';

/**
 * List of matches at the specified event.
 */
export const GET: RequestHandler = async ({ url, params }) => {
	const event = await utilities.findOne('events', {key: params.event_key}, {}, {allowCache: true, maxCacheAge: 300});
	if (!event) throw error(404, new Error(`Event ${params.event_key} not found`));
		
	let earliestTimestamp = url.searchParams.get('earliestTimestamp');
	let completed = url.searchParams.get('completed');
	
	let filter: FilterQueryTyped<Match> = {
		event_key: params.event_key
	};
	
	if (earliestTimestamp) {
		console.log(`Filtering for earliestTimestamp = ${earliestTimestamp}`);
		filter.time = {$gte: parseInt(earliestTimestamp)};
	}
	if (completed) {
		// Whether they want to filter for completed matches or incomplete matches
		let wantsCompleted = (completed === 'true' || completed == '1');
		if (wantsCompleted) {
			console.log('Filtering for completed = true');
			filter['alliances.red.score'] = {
				$gte: 0
			};
		}
		else {
			console.log('Filtering for completed = false');
			filter['alliances.red.score'] = -1;
		}
	}
	
	const matches = await utilities.find('matches', filter, {sort: {time: 1}});
	
	return json(matches);
};