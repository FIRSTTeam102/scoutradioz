import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import { json } from '@sveltejs/kit';
import type { PitScouting } from 'scoutradioz-types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	validateUserOrg(locals, params.org_key);
	const pitscouting: PitScouting[] = await utilities.find('pitscouting', {
		org_key: params.org_key,
		event_key: params.event_key,
	}, {
		sort: { team_key: 1 }
	}, { allowCache: true });
	
	const all = pitscouting.map((pit) => {
		return {
			...pit,
			synced: !!pit.data,
			completed: !!pit.data,
		};
	});

	return json(all);
};
