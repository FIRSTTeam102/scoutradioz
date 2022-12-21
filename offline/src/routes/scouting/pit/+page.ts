import type { PageLoad } from './$types';
import type { PitScouting, TeamKey } from '@firstteam102/scoutradioz-types';

import pitScouting from './dummyPitScouting.json'; // todo: add api call

export const load: PageLoad = async () => {
	let all = pitScouting as unknown as PitScouting[]; //.filter((asg) => asg.event_key === event_key);

	return { all };
};
