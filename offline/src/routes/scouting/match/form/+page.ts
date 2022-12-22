import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';

export const load: PageLoad = async ({ url, fetch }) => {
	const key = url.searchParams.get('key');
	// todo: make more robust, probably into helper function, then consider making one route to show the form for both pit & match
	const teamNumber = Number(key?.split('_')[2]?.replace('frc', ''));

	const layout: LayoutField[] = await (await fetch('/api/layout/match')).json();

	return { layout, key, teamNumber };
};
