import type { PageLoad } from './$types';
import db from '$lib/localDB';
import { sortWithTeamKeyByNumber } from '$lib/utils';

export const load: PageLoad = async ({ fetch, parent }) => {
	const { event_key, org_key } = await parent();

	const assignments = await db.pitscouting
		.where({
			event_key,
			org_key,
		})
		.toArray();
	
	assignments.sort(sortWithTeamKeyByNumber);
	
	return { assignments };
};
