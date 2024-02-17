import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
	// Require org key and event to exist and have been loaded for any of the scouting sub-pages
	const { org_key, event_key, user } = await parent();
	if (!org_key || !event_key || !user) throw redirect(307, '/');
	// now that these values are guaranteed, we can tell typescript so by overwriting them in this sub-layout
	return {
		org_key,
		event_key,
		user,
	};
};