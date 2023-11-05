import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';
import { event_key, getStore, org_key } from '$lib/stores';
import db from '$lib/localDB';

export const load: PageLoad = async ({ url, fetch }) => {
	const key = url.searchParams.get('key');
	// todo: make more robust, probably into helper function, then consider making one route to show the form for both pit & match
	const teamNumber = Number(key?.split('_')[2]?.replace('frc', ''));

	//const layout: LayoutField[] = await (await fetch('/api/layout/match')).json();
	const layout = db.layout
	.where({
		org_key: getStore(org_key),
		year: Number(getStore(event_key)?.substring(0,4)),
		form_type: 'matchscouting'
	})
	.toArray();

	return { layout, key, teamNumber };
};
