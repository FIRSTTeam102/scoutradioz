import { writable, get as getStore, readable, derived } from 'svelte/store';
import type { Writable } from 'svelte/store';

import { liveQuery } from 'dexie';
import db from './localDB';
import { getLogger } from '$lib/logger';

const logger = getLogger('lib/stores');

export { getStore };

// todo: real user
export const userName: Writable<string | undefined> = writable(undefined);
// userName.set('Scott Radius');
export const userId: Writable<string | undefined> = writable(undefined);

export const org_key: Writable<string | undefined> = writable(undefined);
// org_key.set('frc102');

export const event_key: Writable<string | undefined> = writable(undefined);
// event_key.set('2022njski');
export const event_year: Writable<number | undefined> = writable(undefined);
export const event_name: Writable<string | undefined> = writable(undefined);
event_key.subscribe((v) => event_year.set(parseInt(v || '')));

export const deviceOnline: Writable<boolean> = writable(('navigator' in globalThis && 'onLine' in navigator) ? navigator.onLine : false);
if ('addEventListener' in globalThis) {
	addEventListener('online', e => {
		console.log('Online event', e);
		deviceOnline.set(true);
	});
	addEventListener('offline', e => {
		console.log('Offline event', e);
		deviceOnline.set(false);
	});
}
else console.warn('Was unable to add an event listener for deviceOnline. If you see this warning while building/deploying sveltekit or in the nodejs console, everything should be ok, but if you see this in the browser console then the app will not be able to be reactive to the device going online/offline.');

const userObservable = liveQuery(async () => {
	return await db.user.toCollection().first();
});

/**
 * Resolves once the user, org, event_key, etc. stores are loaded from Dexie.
 * If they have already been loaded, the Promise will instantly resolve.
 * 
 * 	export const load: PageLoad = async ({ url, fetch }) => {
 * 		await storesLoaded;
 * 	}
 */
export const storesLoaded = new Promise((resolve, reject) => {
	userObservable.subscribe(async (user) => {
		try {
			if (user) {
				userName.set(user.name);
				userId.set(user._id);
				org_key.set(user.org_key);

				// if org exists
				const org = await db.orgs.where('org_key').equals(user.org_key).first();
				if (org?.event_key) {
					event_year.set(Number(org.event_key?.substring(0, 4)));
					event_key.set(org.event_key);
					// if event exists
					const event = await db.events.where('key').equals(org.event_key).first();
					if (event?.name) {
						event_name.set(event.name);
					}
				}
			}
		}
		catch (err) {
			reject(err);
		}
		resolve(undefined);
	});
});