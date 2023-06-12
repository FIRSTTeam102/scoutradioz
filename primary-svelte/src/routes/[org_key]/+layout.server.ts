import { error } from '@sveltejs/kit';
import type { Event, Team } from 'scoutradioz-types';
import type { LayoutServerLoad } from './$types';
import utilities from '$lib/server/utilities';
import { msg } from '$lib/i18n';

/**
 * Load data when an org is selected.
 */
export const load = (async ({ params, cookies, locals }) => {
	
	const org = await utilities.findOne('orgs', {org_key: params.org_key});
	
	if (!org) throw error(404, 'Not found');
		
	const noEventDefinedStr = msg('manage.event.noEvent');
		
	let eventKey = noEventDefinedStr;
		
	let event: Event | undefined;
	let teams: Team[] | undefined;
	let eventName = noEventDefinedStr;
	let eventIsOrgCurrent = false;
		
	let eventKeyCookie = cookies.get('event_key');
		
	// First check event_key cookie, if not specified then use org.event_key
	if (eventKeyCookie) {
		eventKey = eventKeyCookie;
		eventIsOrgCurrent = false;
	}
	else if (org.event_key) {
		eventKey = org.event_key;
		eventIsOrgCurrent = true;			
	}
		
	event = await utilities.findOne('events', {key: eventKey});
		
	if (event) {
		eventName = `${event.year} ${event.name}`;
			
		//If a list of teams exists, find team info in teams db.
		if (event.team_keys && event.team_keys.length > 0) {
			teams = await utilities.find('teams',
				{'key': {$in: event.team_keys}}, 
				{sort: {team_number: 1}}, 
				{allowCache: true, maxCacheAge: 60}
			);
		}
	}
	else {
		// delete event_key cookie, just in case it's corrupt and there's no event in the db with that key
		cookies.delete('event_key');
	}
		
	// Temporary till i get auth shworking
	// const user = await utilities.findOne('users', {
	// 	org_key: org.org_key,
	// 	name: 'default_user'
	// });
	
	// Get user from session
	let { user } = await locals.auth.validateUser();
	
	console.log('luciaUser', user);
	
	// If there's nobody logged in, replace with default_user
	if (!user) user = await utilities.findOne('users', {
		org_key: org.org_key,
		name: 'default_user'
	});
	
	return {
		org,
		event,
		eventName,
		teams,
		eventIsOrgCurrent,
		user,
	};

}) satisfies LayoutServerLoad;