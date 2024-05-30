import { getLogger } from '$lib/logger';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

const logger = getLogger();

export const load: PageLoad = async (event) => {
	const { org, user } = await event.parent();
	if (!org || !user) {
		logger.info('User/org not found in local db. Redirecting to login page.');
		throw redirect(303, '/login');
	}
	throw redirect(303, '/home');
};
