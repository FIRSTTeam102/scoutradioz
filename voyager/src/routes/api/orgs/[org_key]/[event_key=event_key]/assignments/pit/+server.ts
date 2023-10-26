import utilities from '$lib/server/utilities';
import type { PitScouting } from 'scoutradioz-types';
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const all: PitScouting[] = await utilities.find('pitscouting', {
		org_key: params.org_key,
		event_key: params.event_key,
	}, {
		sort: { team_key: 1 }
	}, { allowCache: true });

	return json(all);
};
