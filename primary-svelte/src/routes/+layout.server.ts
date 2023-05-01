// export const prerender = true;
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';
import utilities from '$lib/server/utilities';

export const load = (({ url }) => {
	
	console.log('Calling refreshtier');
	utilities.refreshTier(env.TIER);
	console.log(utilities.activeTier);
	
	return {
		TIER: env.TIER,
		alert: url.searchParams.get('alert'),
		alertType: url.searchParams.get('type'),
		alertAutoFade: url.searchParams.get('autofade'),
	};
}) satisfies LayoutServerLoad;
