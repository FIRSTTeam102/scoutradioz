import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((value) => {
	return value.substring(0, 3) === 'frc' && !isNaN(parseInt(value.substring(3)));
}) satisfies ParamMatcher;