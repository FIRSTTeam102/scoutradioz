import type { PageLoad } from './$types';
import { storesLoaded } from '$lib/stores';

export const load: PageLoad = async () => {
	// All scouting routes need the user-related stores to load before the pages can load.
	// Putting this await statement inside +layout.ts will make sure the stores load before
	// the sub +page.ts's load.
	await storesLoaded;
};
