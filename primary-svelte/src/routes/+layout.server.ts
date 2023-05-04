// export const prerender = true;
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';
import utilities from '$lib/server/utilities';

export const load = (async ({ url }) => {
	
	const org_key = 'frc102'; // temp
	
	const org = await utilities.findOne('orgs', {org_key});
	const event = await utilities.findOne('events', {key: org.event_key || ''}); // temporary
	
	return {
		TIER: env.TIER,
		alert: url.searchParams.get('alert'),
		alertType: url.searchParams.get('type'),
		alertAutoFade: url.searchParams.get('autofade'),
		org,
		eventName: event?.name || 'No event defined',
	};
}) satisfies LayoutServerLoad;
