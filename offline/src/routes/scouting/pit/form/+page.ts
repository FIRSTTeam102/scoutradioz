import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';

import pitScouting from './dummyPitLayout.json'; // todo: add api call

export const load: PageLoad = async ({ url }) => {
	let key = url.searchParams.get('key');
	let teamNumber = Number(key?.replace('frc', ''));

	let layout = pitScouting as unknown as LayoutField[];

	return { layout, key, teamNumber };
};
