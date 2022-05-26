// JL: Should these be put into a separate package?

import { Document, ObjectId } from 'mongodb';

// General interfaces/types that don't need to be exported
declare interface NumericalDict {
	[key: string]: number;
}

declare interface StringDict {
	[key: string]: string;
}

declare type integer = number;
declare type operand = number|string;
export declare type formDataOutput = number|boolean|string|null;

export declare interface MatchFormData {
	[key: string]: formDataOutput;
}

declare interface AnyDict {
	[key: string]: string|number|boolean|null|undefined
}

export declare interface MongoDocument extends Document {
	/**
	 * MongoDB ID. Declared as optional to assist the creation of data structures in code, because it does not need to be specified in an insert statement.
	 */
	_id?: ObjectId;
}

/**
 * Contains the min, max, average, and variance for a given numerical metric from an org's match scouting form.
 * @collection aggranges
 * @interface AggRange
 */
export declare interface AggRange extends MongoDocument {
	org_key: OrgKey;
	event_key: EventKey;
	key: string;
	MINmin: number;
	MINmax: number;
	AVGmin: number;
	AVGmax: number;
	VARmin: number;
	VARmax: number;
	MAXmin: number;
	MAXmax: number;
}

/**
 * Data for an event -- From TBA API.
 * @collection events
 * @interface Event
 */
export declare interface Event extends MongoDocument {
	city: string|null;
	country: string;
	district: string|null;
	end_date: string;
	event_code: string;
	event_type: number;
	key: EventKey;
	name: string;
	start_date: string;
	state_prov: string;
	year: number;
	team_keys: TeamKey[]
}

/**
 * A question/metric in the pit or match scouting form.
 * @collection layout
 * @interface Layout
 */
export declare interface Layout extends MongoDocument {
	year: number;
	order: number|string;
	type: 'checkbox'|'counter'|'badcounter'|'slider'|'timeslider'|'multiselect'|'textblock'|'h2'|'h3'|'spacer'|'derived';
	form_type: 'matchscouting'|'pitscouting';
	org_key: OrgKey;
	label?: string;
	id?: string;
}

/**
 * A derived metric in the match scouting form.
 * @collection layout
 * @interface DerivedLayout
 */
export declare interface DerivedLayout extends Layout{
	type: 'derived';
	operations: DerivedOperation[];
	display_as?: string;
}

export declare interface DerivedOperation {
	operator: string;
	id: string;
	as?: string;
}

export declare interface MultiplyOperation extends DerivedOperation {
	operator: 'multiply';
	operands: operand[];
}

export declare interface SumOperation extends DerivedOperation {
	operator: 'sum'|'add';
	operands: operand[];
}

export declare interface SubtractOperation extends DerivedOperation {
	operator: 'subtract';
	operands: [operand, operand];
}

export declare interface DivideOperation extends DerivedOperation {
	operator: 'divide';
	operands: [operand, operand];
}

export declare interface MultiselectOperation extends DerivedOperation {
	quantifiers: NumericalDict;
}

export declare interface ConditionOperation extends DerivedOperation {
	operator: 'condition';
	operands: [string, string|number|null, string|number|null];
}

export declare interface CompareOperation extends DerivedOperation {
	operator: 'gt'|'gte'|'lt'|'lte'|'eq'|'ne';
	operands: [operand, operand];
}

/**
 * Data for a match -- From TBA API.
 * @collection matches
 * @interface Match
 */
export declare interface Match extends MongoDocument {
	key: MatchKey;
	event_key: EventKey;
	comp_level: CompLevel;
	set_number: number;
	match_number: number;
	alliances: {
		red: MatchAllianceInfo,
		blue: MatchAllianceInfo,
	};
	winning_alliance: 'red' | 'blue' | '';
	score_breakdown: {
		red: AnyDict;
		blue: AnyDict;
	};
	videos: Array<MatchVideo>;
	time: number;
	actual_time: number;
	predicted_time: number;
	post_result_time?: number;
}

declare class MatchAllianceInfo {
	team_keys: Array<TeamKey>;
	score: number;
	surrogate_team_keys: Array<TeamKey>;
	dq_team_keys: Array<TeamKey>;
}

declare class MatchVideo {
	type: string;
	key: string;
}

/**
 * Match scouting data & assignments for a given team at a given match.
 * @collection matchscouting
 * @interface MatchScouting
 */
export declare interface MatchScouting extends MongoDocument {
	year: number;
	event_key: EventKey;
	org_key: OrgKey;
	match_key: MatchKey;
	match_number: number;
	time: number;
	alliance: 'red' | 'blue';
	team_key: TeamKey;
	match_team_key: MatchTeamKey;
	assigned_scorer?: string;
	actual_scorer?: string;
	data?: MatchFormData;
	useragent?: UserAgent;
}

/**
 * An organization who uses Scoutradioz.
 * @collection orgs
 * @interface Org
 */
export declare interface Org extends MongoDocument {
	org_key: OrgKey;
	nickname: string;
	team_number?: integer;
	team_numbers?: integer[];
	team_key?: TeamKey;
	team_keys?: TeamKey[];
	default_password: string;
	config: {
		members: {
			subteams: Array<OrgSubteam>;
			classes: Array<OrgClass>;
		};
		columnDefaults: StringDict;
	}
}

export declare interface OrgSubteam {
	label: string;
	subteam_key: string;
	pit_scout: boolean;
}

export declare interface OrgClass {
	label: string;
	class_key: string;
	seniority: number;
	youth: boolean;
}

/**
 * Values for each team that an org sets on their alliance selection page.
 * @collection orgteamvalues
 * @interface OrgTeamValue
 */
export declare interface OrgTeamValue extends MongoDocument {
	org_key: OrgKey;
	team_key: TeamKey;
	event_key: EventKey;
	value: number;
}

/**
 * Headers for TBA API calls.
 * @collection passwords
 */
export declare interface TBAApiHeaders extends MongoDocument {
	name: 'tba-api-headers';
	headers: StringDict;
}

/**
 * Headers for FIRST API calls.
 * @collection passwords
 */
export declare interface FIRSTApiHeaders extends MongoDocument {
	name: 'first-api-headers';
	headers: StringDict;
}

/**
 * Secret key for TBA webhooks
 * @collection passwords
 */
export declare interface TBAWebhookSecret extends MongoDocument {
	name: 'tba-webhook-secret';
	secret_key: string;
}

/**
 * Public/private keys for web push API.
 * @collection passwords
 */
export declare interface WebPushKeys extends MongoDocument {
	name: 'web_push_keys';
	public_key: string;
	private_key: string;
}

/**
 * Pit scouting data & assignments for a given team at a given event.
 * @collection pitscouting
 * @interface PitScouting
 */
export declare interface PitScouting extends MongoDocument {
	year: number;
	event_key: EventKey;
	org_key: OrgKey;
	team_key: TeamKey;
	primary: string;
	secondary: string;
	actual_scouter?: string;
	data?: StringDict;
	useragent?: UserAgent;
}

/**
 * Contains info for each ranking point for a given year. Manually declared & added each year.
 * The "name" field refers to the key used inside Match.score_breakdown.blue and Match.score_breakdown.red, such as cargoBonusRankingPoint.
 * @collection rankingpoints
 * @interface RankingPoints
 */
export declare interface RankingPoints extends MongoDocument {
	year: number;
	attributes: RankingPoint[];
}

export declare interface RankingPoint extends MongoDocument {
	label: string;
	name: string;
	abbr: string;
}

/**
 * Identifies a team's ranking at a given event -- From TBA API.
 * @collection rankings
 * @interface Ranking
 */
export declare interface Ranking extends MongoDocument {
	dq: number;
	extra_stats: any[];
	matches_played: number;
	qual_average: any;
	rank: number;
	record: {
		losses: number;
		ties: number;
		wins: number;
	};
	sort_orders: number[];
	team_key: TeamKey;
	event_key: EventKey;
}

/**
 * From the roles collection. Identifies a user's permission level. Each user (currently) has only one role.
 * @collection roles
 * @interface Role
 */
export declare interface Role {
	role_key: RoleKey;
	label: string;
	access_level: integer;
}

/**
 * From the scoutingpairs collection. Used in pit scouting.
 * @interface ScoutingPair
 */
export declare interface ScoutingPair {
	member1: string;
	member2: string;
	member3?: string;
	org_key: OrgKey;
}

/**
 * Handled automatically.
 * @collection sessions
 * @interface Session
 */
export declare interface Session {
	expires: Date;
	lastModified: Date;
	session: string;
}

/**
 * Contains a team's 40x40 avatar for a given event year -- From FIRST API.
 * @collection teamavatars
 * @interface TeamAvatar
 */
export declare interface TeamAvatar {
	team_number: integer;
	event_year: integer;
	/**
	 * Does not include the "data:image/png;base64," prefix
	 */
	encoded_avatar: string;
}

/**
 * Team info -- From TBA API.
 * @collection teams
 * @interface Team
 */
export declare interface Team extends MongoDocument {
	address: string|null;
	city: string|null;
	country: string|null;
	gmaps_place_id: any;
	gmaps_url: any;
	key: TeamKey;
	lat: any;
	lng: any;
	location_name: any;
	motto: string|null;
	name: string;
	nickname: string;
	postal_code: string|null;
	rookie_year: number|null;
	school_name: string|null;
	state_prov: string|null;
	team_number: number;
	website: string|null;
}

/**
 * Contains info for a user-uploaded image.
 * @collection uploads
 * @interface Upload
 */
export declare interface Upload extends MongoDocument {
	org_key: OrgKey;
	year: number;
	team_key: TeamKey;
	uploader: {
		name: string;
		id: string;
		useragent: UserAgent;
		upload_time: number;
	}
	s3_key: string;
	index: number;
	removed?: boolean;
}

/**
 * A user of a given org.
 * @collection users
 * @interface User
 */
export declare interface User {
	org_key: OrgKey;
	name: string;
	role_key: RoleKey;
	password: string;
	org_info: {
		subteam_key: string;
		class_key: string;
		years: string|number; // TODO: only number
		seniority: string|number; // TODO: only number
	};
	event_info: {
		present: boolean;
		assigned: boolean;
	};
	visible: boolean;
	push_subscription?: PushSubscription
}

export declare type RoleKey = 'scouter' | 'viewer' | 'team_admin' | 'global_admin';
export declare type OrgKey = string;
export declare type EventKey = string;
export declare type MatchKey = string;
export declare type MatchTeamKey = string;
export declare type TeamKey = string;
export declare type CompLevel = 'qm' | 'qf' | 'sf' | 'f';

/**
 * Shortened useragent of the individual who inserted a given datum.
 * @interface UserAgent
 */
export declare interface UserAgent {
	ip: string;
	device: string;
	os: string;
	browser: string;
}
