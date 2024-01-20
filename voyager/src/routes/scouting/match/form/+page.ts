import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import type { LayoutField } from '$lib/types';
import { event_key, getStore, org_key, storesLoaded, } from '$lib/stores';
import { requireStores } from '$lib/utils';
import db from '$lib/localDB';

export const load: PageLoad = async ({ url, fetch }) => {
	await requireStores(event_key, org_key);

	const key = url.searchParams.get('key');
	if (!key) throw error(400, new Error('Match-team key not specified'));

	const team_key = key.split('_')[2];

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
	
	const team = await db.teams
		.where('key').equals(team_key).first();
	
	if (!team) throw error(404, new Error(`Team info not found for key ${team_key}!`));

	return { layout, key, team, matchScoutingEntry };
};
