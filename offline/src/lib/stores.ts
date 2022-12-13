import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// todo: real user
export const user: Writable<string | null> = writable(null);
user.set('Scott Radius');