import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';
import { error } from '@sveltejs/kit';
import { event_key, getStore, org_key } from '$lib/stores';
import db from '$lib/localDB';

export const load: PageLoad = async ({ url, fetch }) => {
	const key = url.searchParams.get('key');
	
	const teamNumber = Number(key?.replace('frc', ''));

	if (!key || !teamNumber) throw error(404, new Error('Team key is either not defined or invalid'));

	//const layout: LayoutField[] = await (await fetch('/api/layout/pit')).json();
	const layout = db.layout
	.where({
		org_key: getStore(org_key),
		year: Number(getStore(event_key)?.substring(0,4)),
		form_type: 'pitscouting'
	})
	.toArray();

	return { layout, key, teamNumber };
};
