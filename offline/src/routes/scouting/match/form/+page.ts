import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';

import matchScouting from './dummyMatchLayout.json'; // todo: add api call

export const load: PageLoad = async ({ url }) => {
	let key = url.searchParams.get('key');
	let teamNumber = Number(key?.split('_')[2]?.replace('frc', '')); // todo: make more robust, probably into helper function

	let layout = matchScouting as unknown as LayoutField[];

	return { layout, key, teamNumber };
};
