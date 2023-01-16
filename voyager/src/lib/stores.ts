import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

import { get as getStore } from 'svelte/store';
export { getStore };

// todo: real user
export const user: Writable<string | null> = writable(null);
user.set('Scott Radius');

export const org_key: Writable<string | null> = writable(null);
org_key.set('frc102');

export const event_key: Writable<string | null> = writable(null);
event_key.set('2022njski');
export const event_year: Writable<number | null> = writable(null);
event_key.subscribe((v) => event_year.set(parseInt(v || '')));