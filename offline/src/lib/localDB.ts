import Dexie, { type Table } from 'dexie';
import type { User, Event, Layout, Match, TeamKey, MatchScouting, Team } from '@firstteam102/scoutradioz-types';

/**
 * Minimal version of the User interface, for transferring via QR code.
 */
export interface LightUser {
	_id: string;
	org_key: string;
	name: string;
	role_key: string;
	event_info: {
		present: boolean;
		assigned: boolean;
	}
}

export interface LightMatchAllianceInfo {
	team_keys: TeamKey[];
}

export interface LightMatch {
	key: string;
	event_key: string;
	comp_level: string;
	set_number: number;
	match_number: number;
	alliances: {
		red: LightMatchAllianceInfo;
		blue: LightMatchAllianceInfo;
	}
	time: number;
}

/**
 * Svelte can't transmit ObjectIds from server to client, so they have to be transformed into strings.
 */
type WithStringDbId<T> = Omit<T, '_id'> & {_id: string};

export class LocalDB extends Dexie {
	// Lightweight schemas that contain only the info necessary to transmit via QR code
	lightusers!: Table<LightUser>;
	lightmatches!: Table<LightMatch>;
	// Schemas straight from the DB
	events!: Table<WithStringDbId<Event>>;
	layout!: Table<WithStringDbId<Layout>>;
	matchscouting!: Table<WithStringDbId<MatchScouting>>;
	teams!: Table<WithStringDbId<Team>>;
	
	constructor() {
		super('scoutradioz-offline');
		this.version(3).stores({
			lightusers: '&_id, org_key, name, role_key, event_info.present, event_info.assigned',
			lightmatches: '&key, time',
			
			events: '&_id, &key, year',
			layout: '&_id, [org_key+year+form_type]',
			matchscouting: '&_id, &match_team_key, org_key, event_key, team_key, year',
			teams: '&_id, &key, team_number'
		});
	}
}

const db = new LocalDB();

export default db;