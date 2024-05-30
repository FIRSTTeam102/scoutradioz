import type { PageLoad } from './$types';
import db from '$lib/localDB';
import { sortWithTeamKeyByNumber } from '$lib/utils';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ fetch, parent }) => {
	const { event_key, org_key } = await parent();

	const assignments = await db.pitscouting
		.where({
			event_key,
			org_key,
		})
		.toArray();
	
	assignments.sort(sortWithTeamKeyByNumber);
	
	const syncStatus = await db.syncstatus.where({
		table: 'pitscouting',
		filter: `org=${org_key},event=${event_key}`
	}).first();
	
	if (!syncStatus || (typeof syncStatus.data?.checksum !== 'string')) throw error(404, new Error('Pit scouting schedule information not found!'));
	
	let checksum = syncStatus.data.checksum.substring(0, 3) as string;
	
	return { assignments, checksum };
};
