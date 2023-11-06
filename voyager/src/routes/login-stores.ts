import { writable, type Writable } from 'svelte/store';
import type { Org } from 'scoutradioz-types'
import type { LightUser } from '$lib/localDB';

/**
 * These stores should ONLY be used in the login procedure. 
 * They aren't tied to anything in the Dexie db, it's just to 
 * make the values persist in memory while navigating between
 * the multiple steps of the login process.
 * */
export const org: Writable<Org|null> = writable(null);
export const org_password = writable('');
export const user: Writable<LightUser|null> = writable(null);
