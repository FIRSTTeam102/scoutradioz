import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = function ({params}) {
	throw redirect(307, `${params.org_key}/home`);
} satisfies PageServerLoad;