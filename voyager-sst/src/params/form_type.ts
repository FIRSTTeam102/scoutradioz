import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Validates whether the param is a valid form type, i.e. pit or match scouting
 */
export const match = ((value) => {
	return (value === 'pit' || value === 'match');
}) satisfies ParamMatcher;