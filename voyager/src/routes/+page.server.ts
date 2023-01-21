// import { error } from '@sveltejs/kit';
import type { LightUser } from '$lib/localDB';
import type { Team } from '@firstteam102/scoutradioz-types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await fetch('/api/teams');

	return {
		teams: await response.json() as Team[]
	};
};