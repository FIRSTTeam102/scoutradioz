import utilities from '$lib/server/utilities';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * List of teams at the specified event.
 */
export const GET: RequestHandler = async ({ params }) => {
	const event = await utilities.findOne(
		'events',
		{ key: params.event_key },
		{ projection: { _id: 0 } }
	);

	if (!event) throw error(404, new Error(`Event ${params.event_key} not found`));

	return json(event);
};
