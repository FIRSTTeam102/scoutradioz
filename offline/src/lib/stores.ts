import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// todo: real user
export const user: Writable<string | null> = writable(null);
user.set('Scott Radius');
export const org_key: Writable<string | null> = writable(null);
org_key.set('frc102');
