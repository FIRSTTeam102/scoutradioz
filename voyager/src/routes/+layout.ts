import type { LayoutLoad } from './$types';
import { i18n } from '$lib/i18n';
import { browser } from '$app/environment';
import db, { type str } from '$lib/localDB';
import type { Event } from 'scoutradioz-types';
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
	if (browser) {
		await i18n.middleware();
		const user = await db.user.toCollection().first();
		if (!user) {
			return {};
		}
		console.log('user', user);
		const org_key = user.org_key;
		const user_id = user._id;
		const user_name = user.name;
		const org = await db.orgs.where({org_key}).first();

		let event_key: string|undefined;
		let event: str<Event>|undefined;
		if (org?.event_key) {
			event_key = org.event_key;
			event = await db.events.where('key').equals(event_key).first();
		}
		return {
			user,
			org_key,
			user_id,
			user_name,
			org,
			event_key,
			event,
		};
	}
};