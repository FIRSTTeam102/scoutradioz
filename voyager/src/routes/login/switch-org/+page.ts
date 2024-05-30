import { browser } from '$app/environment';
import db from '$lib/localDB';
import { error, redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { invalidateAll } from '$app/navigation';

export const load: PageLoad = async (event) => {
	console.log('pick-user page.ts running (should be client side!!)');
	if (!browser) {
		throw error(500, new Error('This should not be running server side!!!'));
	}
	// Clear the user table and then force all routes to reload their PageData
	await db.user.clear(); 
	redirect(302, '/login');
};