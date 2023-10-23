import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((value) => {
	return /^[0-9]+$/.test(value);
}) satisfies ParamMatcher;