// import { error } from '@sveltejs/kit';
import utilities from '$lib/server/utilities';
import type { User } from '@firstteam102/scoutradioz-types';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	let users: User[] = await utilities.find('users', {});
	return {
		users
	};
};