import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import utilities from 'scoutradioz-utilities';

export const load = (async ({ params, parent }) => {
	
	const ldata = await parent();
	
	const event_key = ldata.event.key;
	
	let rankings = await utilities.find('rankings', 
		{event_key}, 
		{sort:{rank: 1}}
	);
	
	return {
		rankings
	};
}) satisfies PageServerLoad;