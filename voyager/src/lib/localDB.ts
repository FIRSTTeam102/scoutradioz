import { browser } from '$app/environment';
import Dexie, { type Table } from 'dexie';
import type {
	Org,
	User,
	Event,
	Layout,
	Match,
	TeamKey,
	MatchScouting,
	Team,
	PitScouting,
	ScouterRecord,
	AnyDict,
	OrgKey,
	Schema,
	EventKey,
	OrgSchema,
} from 'scoutradioz-types';

/**
 * Svelte can't transmit ObjectIds from server to client, so they have to be transformed into strings.
 */
export type WithStringDbId<T> = Omit<T, '_id'> & { _id: string };
/** Shorthand for {@link WithStringDbId<T>} */
export type str<T> = WithStringDbId<T>;
/**
 * Minimal version of the User interface, for transferring via QR code.
 */

export interface LightUser {
	_id: number;
	org_key: string;
	name: string;
	role_key: string;
	event_info: {
		present: boolean;
		assigned: boolean;
	};
}

export interface LightMatchAllianceInfo {
	team_keys: TeamKey[];
	score: number;
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
	};
	time: number;
}

/**
 * Details about an org that are publicly accessible, which can be downloaded by any user
 * regardless of authentication.
 */
export interface LightOrg {
	org_key: OrgKey;
	nickname: string;
	team_number?: number;
	team_numbers?: number[];
	team_key?: TeamKey;
	team_keys?: TeamKey[];
	event_key: EventKey|null;
}

/**
 * Details about an org that can be downloaded after a user has authenticated as part
 * of that org. The default_password field is removed because it's considered bad practices
 * (as far as I'm aware) to give people/devices access to hashed passwords.
 */
export type OrgLocal = Omit<Org, 'default_password'|'_id'>;

export interface MatchScoutingWithTeamName extends WithStringDbId<MatchScouting> {
	team_name?: string;
}

/** {@link ScouterRecord} but with a string id */
export interface ScouterRecordLocal {
	id: number;
	name: string;
}

export type MatchScoutingLocal = Omit<
	MatchScouting,
	'_id' | 'assigned_scorer' | 'actual_scorer'
> & {
	team_name?: string;
	assigned_scorer?: ScouterRecordLocal;
	actual_scorer?: ScouterRecordLocal;
	/**
	 * Whether this entry has been marked as completed. The `data` field gets autosaved as it's entered, but `completed`
	 * only gets set when the Done button is clicked.
	 */
	completed?: boolean;
	/**
	 * Whether this entry has been marked as synced (whether uploaded by this device or marked as synced after showing qr code)
	 */
	synced?: boolean;
};

export type PitScoutingLocal = Omit<
	PitScouting,
	'_id' | 'primary' | 'secondary' | 'tertiary' | 'actual_scouter'
> & {
	primary?: ScouterRecordLocal;
	secondary?: ScouterRecordLocal;
	tertiary?: ScouterRecordLocal;
	actual_scouter?: ScouterRecordLocal;
	/**
	 * Whether this entry has been marked as completed. The `data` field gets autosaved as it's entered, but `completed`
	 * only gets set when the Done button is clicked.
	 */
	completed?: boolean;
	/**
	 * Whether this entry has been marked as synced (whether uploaded by this device or marked as synced after showing qr code)
	 */
	synced?: boolean;
};

export type EventLocal = Omit<Event, '_id'>;

export interface TeamLocal {
	city: string | null;
	country: string | null;
	key: TeamKey;
	name: string;
	nickname: string;
	state_prov: string | null;
	team_number: number;
}

export interface Log {
	id?: number;
	group: string;
	level: number;
	time: Date;
	message: string;
}

export interface SyncStatus {
	id?: number;
	/** Table, for example orgs or matchscouting */
	table: string;
	/** The time the sync occurred */
	time: Date;
	/**
	 * Some sort of filter for the query to the database. Leaving it open-ended
	 * for different tables. For example, matchscouting could use "frc102_2019paca"/
	 * "frc41_2024njski" to indicate different orgs+events downloaded
	 * and events could use "2022"/"2023" to indicate different years downloaded.
	 * The reason this is a string instead of an object is because IndexedDB doesn't
	 * support indexing by objects. The syntax of the string must be consistent across
	 * pages that use it, for any given table. Syntaxes can be different between tables.
	 */
	filter: string;
	/** 
	 * Any extra information to store in the syncstatus. For example: storing a letter
	 * for the current version of the pit scouting schedule
	 */
	data?: any;
}

export const defaultPreferences = {
	enableAutoSync: true
};

/** User preferences. Stored on-device, not synced. */
export type Preferences = typeof defaultPreferences & {
	id?: number;
};

export class LocalDB extends Dexie {
	// Lightweight schemas that contain only the info necessary to transmit via QR code
	// 	(or with redacted information for public downloadability)
	lightusers!: Table<LightUser>;
	lightmatches!: Table<LightMatch>;
	/** PUBLICLY accessible org information */
	lightorgs!: Table<LightOrg>;
	user!: Table<LightUser>;
	// Schemas straight from the DB
	events!: Table<EventLocal>;
	layout!: Table<str<Layout>>;
	matchscouting!: Table<MatchScoutingLocal>;
	pitscouting!: Table<PitScoutingLocal>;
	
	schemas!: Table<str<Schema>>;
	
	teams!: Table<TeamLocal>;
	/** Includes org config info that can only be viewed after authenticating */
	orgs!: Table<OrgLocal>;
	orgschemas!: Table<str<OrgSchema>>;
	

	logs!: Table<Log>;
	syncstatus!: Table<SyncStatus>;
	preferences!: Table<Preferences>;

	constructor() {
		super('scoutradioz-offline');
		this.version(52).stores({
			lightusers: '&_id, org_key, name, role_key',
			lightmatches:
				'&key, time, event_key, [event_key+comp_level], alliances.red.score, match_number',
			user: '&_id',
			lightorgs: '&org_key',

			// JL note: I think it's okay to use ++_id as an index. The ++ means that if it's not specified, it'll be autogenerated.
			// 	In the case of layout, _id will come from the server, and if we don't index _id, then Dexie will think that
			// 	multiple entries with the same org_key+year+form_type are identical and will only enter one.
			events: '&key, year',
			layout: '++_id, [org_key+year+form_type], order',
			// JL TODO: matchscouting can't have its primary key be match_team_key because it breaks multi-org stuff
			matchscouting: '&match_team_key, [org_key+event_key], team_key, year, time, match_number',
			// 2024-02-19 JL: Removed primary/secondary/tertiary indexes from collection b/c it can't handle when they are undefined
			pitscouting: '&[org_key+event_key+team_key], [org_key+event_key]',
			schemas: '&_id',
			teams: '&key, team_number',
			orgs: '&org_key',
			orgschemas: '&[org_key+year+form_type]',

			logs: '++id, group, time',
			syncstatus: '&[table+filter], date',
			preferences: '++id'
		});
	}
}

let db: LocalDB;
if (browser) db = new LocalDB();
// @ts-ignore
export default db;

// WIP code to detect when there's an upgrade error "Not yet support for changing primary key"
if ('addEventListener' in globalThis)
	addEventListener('unhandledrejection', async (e) => {
		if (e.reason && e.reason.name === 'AbortError') {
			try {
				let user = await db.user.get(1);
			}
			catch (err) {
				if (err instanceof Error) {
					if (
						err.name === 'DatabaseClosedError' &&
						err.message.includes('Not yet support for changing primary key')
					) {
						console.log('Database upgrade error detected. Attempting to fix...');
						const result = confirm(
							'The app appears to have been updated, and the database was unable to automatically upgrade itself. To upgrade the database, we need to delete all your offline data. Can we continue with deleting your offline data?'
						);
						if (result === true) {
							console.log('Retrieved permission to delete local database. Deleting...');
							await db.delete();
							alert(
								'The database has been deleted. The page will reload after you click OK. If this message appears after you reload the page, please contact the developers.'
							);
							setTimeout(() => {
								window.location.reload();
							}, 500);
						}
					}
				}
			}
		}
	});

//@ts-ignore
if (browser) window.db = db; // For debugging