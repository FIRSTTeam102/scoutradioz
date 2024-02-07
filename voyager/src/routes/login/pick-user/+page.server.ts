import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.session || !event.locals.user) {
		throw error(401, new Error('User is not logged in to an org'));
	}
};
