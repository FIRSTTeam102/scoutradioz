import type { PageLoad } from './$types';
import type { PitScouting } from 'scoutradioz-types';
import { event_key, getStore, org_key, whenStoresLoaded } from '$lib/stores';
import db from '$lib/localDB';
import { sortWithTeamKeyByNumber } from '$lib/utils';

export const load: PageLoad = async ({ fetch }) => {
	await whenStoresLoaded();
	const where = {
			event_key: getStore(event_key),
			org_key: getStore(org_key)
		}
	console.log('where', where);

	const assignments = await db.pitscouting
		.where(where)
		.toArray();
	
	assignments.sort(sortWithTeamKeyByNumber); // JL note: can't 
	
	return { assignments };
};
