import type { PageLoad } from './$types';
import type { PitScouting } from 'scoutradioz-types';
import { event_key, getStore, org_key } from '$lib/stores';
import db from '$lib/localDB';
import { sortWithTeamKeyByNumber } from '$lib/utils';

export const load: PageLoad = async ({ fetch }) => {

	const assignments = await db.pitscouting
		.where({
			event_key: getStore(event_key),
			org_key: getStore(org_key)
		})
		.toArray();
	
	assignments.sort(sortWithTeamKeyByNumber); // JL note: can't 
	
	return { assignments };
};
