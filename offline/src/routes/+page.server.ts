// import { error } from '@sveltejs/kit';
import type { LightUser } from '$lib/localDB';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await fetch('/api/users');

	return {
		users: await response.json() as LightUser[]
	};
};