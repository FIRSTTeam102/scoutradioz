import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

import { get as getStore } from 'svelte/store';
import { liveQuery } from 'dexie';
import db from './localDB';
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
event_key.subscribe((v) => event_year.set(parseInt(v || '')));


const userObservable = liveQuery(async () => {
	return await db.user.toCollection().first();
	// const userDB = await db.user.toCollection().first();
	// console.log('userdb', userDB)
	// if (userDB) {
	// 	userName.set(userDB.name);
	// 	userID.set(userDB._id);
	// 	org_key.set(userDB.org_key);

	// 	const org = await db.orgs.where('org_key').equals(userDB.org_key).first();
	// 	if (org?.event_key) event_key.set(org.event_key);
	// }
});

// Temporary hackiness to make sure that the stores are loaded before the page is rendered
// TODO: a more Svelte-ish way to do this
let dataRetrieved = false;
let resolves: ((...args: unknown[]) => void)[] = [];
export function whenStoresLoaded() {
	return new Promise((resolve) => {
		if (dataRetrieved) resolve(undefined);
		else resolves.push(resolve);
	})
}

userObservable.subscribe(async (user) => {
	if (user) {
		userName.set(user.name);
		userId.set(user._id);
		org_key.set(user.org_key);

		const org = await db.orgs.where('org_key').equals(user.org_key).first();
		if (org?.event_key) event_key.set(org.event_key);
		if (org?.event_key) event_year.set(Number(org.event_key?.substring(0, 4)))
	}

	dataRetrieved = true;
	resolves.forEach((resolve) => resolve(undefined));
});
