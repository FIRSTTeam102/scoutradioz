import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import db from '$lib/localDB';

export const load: PageLoad = async (event) => {
	console.log('pick-user page.ts running!');

	// Pull the data used by the svelte page straight from the db in this page
	// 	As far as I can tell, we can't really use invalidateAll() because it casues the page to refresh
	const user = await db.user.toCollection().first();
	if (!user) {
		throw error(401, new Error('User not found in Dexie, but it should be if you reached login/pick-user/+page.ts!'));
	}
	const org_key = user.org_key;
	const org = await db.orgs.where({org_key}).first();
	if (!org) {
		throw error(500, new Error('Full org details not found in Dexie!'));
	}
	return {
		user,
		org,
		org_key,
	};
};
