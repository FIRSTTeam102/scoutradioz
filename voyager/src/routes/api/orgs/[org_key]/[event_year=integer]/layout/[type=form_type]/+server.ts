import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import type { LayoutField } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	validateUserOrg(locals, params.org_key);
	const form_type = (params.type + 'scouting') as 'pitscouting'|'matchscouting';

	const layout: LayoutField[] = await utilities.find('layout', {
		year: parseInt(params.event_year),
		org_key: params.org_key,
		form_type,
		type: { $ne: 'derived' } // not needed for ui, might change later
	}, {
		sort: { order: 1 },
		projection: { _id: 0 }
	}, { allowCache: true });

	return json(layout);
};