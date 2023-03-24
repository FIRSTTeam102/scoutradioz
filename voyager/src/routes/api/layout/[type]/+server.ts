import utilities from '$lib/server/utilities';
import { error } from '@sveltejs/kit';
import { org_key, event_year, getStore } from '$lib/stores';
import type { LayoutField } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!['pit', 'match'].includes(params.type)) throw error(404, new Error('Invalid form type'));
	
	const form_type = (params.type + 'scouting') as 'pitscouting'|'matchscouting';

	const layout: LayoutField[] = await utilities.find('layout', {
		year: getStore(event_year),
		org_key: getStore(org_key),
		form_type,
		type: { $ne: 'derived' } // not needed for ui, might change later
	}, {
		sort: { order: 1 },
		projection: { _id: 0, form_type: 0, org_key: 0 }
	}, { allowCache: true });

	return new Response(JSON.stringify(layout), {
		headers: {
			'content-type': 'application/json'
		}
	});
};