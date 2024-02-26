import { redirectWithAlert } from '$lib/utils';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, parent, params }) => {
	const { org_key, event } = await parent();
	if (!event) {
		throw redirectWithAlert('/sync/lead', 'Event not found in local database, try re-syncing');
	}

	const key = params.key;
	if (!key) throw error(400, new Error('Match-team key not specified'));
	
	return { key, event, org_key, };
};
