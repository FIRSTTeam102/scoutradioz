import type { PageLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutField } from '$lib/types';
import { event_key, getStore, org_key, } from '$lib/stores';
import db from '$lib/localDB';

export const load: PageLoad = async ({ url, fetch }) => {
	// check if logged in
	if (!getStore(event_key) || !getStore(org_key)) {
		throw redirect(307, '/');
	}

	const key = url.searchParams.get('key');
	// todo: make more robust, probably into helper function, then consider making one route to show the form for both pit & match
	const teamNumber = Number(key?.split('_')[2]?.replace('frc', ''));
	
	if (!key) throw error(400, new Error('Match-team key not specified'));

	const layout = db.layout
		.where({
			org_key: getStore(org_key),
			year: Number(getStore(event_key)?.substring(0,4)),
			form_type: 'matchscouting'
		})
		.toArray();
	
	// TODO: multi org
	const matchScoutingEntry = await db.matchscouting
		.where('match_team_key').equals(key).first();
	
	if (!matchScoutingEntry) throw error(404, new Error(`Match scouting assignment not found for key ${key}!`));

	return { layout, key, teamNumber, matchScoutingEntry };
};
