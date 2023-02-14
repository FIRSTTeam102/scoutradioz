import utilities from '$lib/server/utilities';
import { org_key, event_key, getStore } from '$lib/stores';
import type { PitScouting } from '@firstteam102/scoutradioz-types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const all: PitScouting[] = await utilities.find('pitscouting', {
		org_key: getStore(org_key),
		event_key: getStore(event_key)
	}, {
		sort: { team_key: 1 }
	}, { allowCache: true });

	return new Response(JSON.stringify(all), {
		headers: {
			'content-type': 'application/json'
		}
	});
};