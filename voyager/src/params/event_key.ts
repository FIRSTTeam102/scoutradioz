import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Tests whether it's a valid event_key. 4 digit year followed by any word character.
 */
export const match = ((value) => {
	return /^[0-9]{4}\w+$/.test(value);
}) satisfies ParamMatcher;