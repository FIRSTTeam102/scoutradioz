import { error } from '@sveltejs/kit';
import utilities from '$lib/server/utilities';
import type { User } from '@firstteam102/scoutradioz-types';
import { ObjectId } from 'mongodb';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	let users: User[] = await utilities.find('users', {});
	// console.log(users);
	return {
		users
	};
	// let promise: Promise<User[]> = utilities.find('users', {});
	// return {
	// 	users: {
	// 		promise: Promise.resolve('c')
	// 	}
	// };
};