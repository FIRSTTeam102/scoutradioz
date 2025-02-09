// JL: Should these be put into a separate package?

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type { ObjectId } from 'mongodb';

// General interfaces/types that don't need to be exported
declare interface NumericalDict {
	[key: string]: number;
}

declare interface StringDict {
	[key: string]: string;
}

declare type integer = number;
export declare type formDataOutput = number|boolean|string|null;

export declare interface MatchFormData {
	[key: string]: formDataOutput;
}

declare interface AnyDict {
	[key: string]: string|number|boolean|null|undefined
}

// 2022-12-10 JL: Removed 'extends Document' and renamed to 'DocumentWithID' to:
// 	1. Allow our schemas to be modified via Omit (the fact that Document has [key: string]: any messes things up)
// 	2. prevent confusion with the MongoDocument type exported from scoutradioz-utilities
export declare interface DbDocument {
	/**
	 * MongoDB ID. Declared as optional to assist the creation of data structures in code, because it does not need to be specified in an insert statement.
	 */
	_id?: ObjectId;
}

/** Document with an auto-incrementing number, for use in Voyager QR codes */
export declare interface DbDocumentWithNumberId {
	/**
	 * Numerical ID. (JL note: Utilities driver does the auto-incrementing)
	 */
	_id?: number;
}

/**
 * Optionally explicitly declare that a given object retrieved from the database has `_id` set.
 * @example
 * 
 * 	let users: WithDbId<User>[] = await utilities.find('users', {});
 */
export declare type WithDbId<T extends DbDocument|DbDocumentWithNumberId> = T & Required<Pick<T, '_id'>>


/**
 * Contains the min, max, average, and variance for a given numerical metric from an org's match scouting form.
 * @collection aggranges
 * @interface AggRange
 */
export declare interface AggRange extends DbDocument {
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
export declare interface Event extends DbDocument {
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
	team_keys: TeamKey[];
	timezone?: string|null;
}

declare interface FormSliderOptions {
	min: number;
	max: number;
	step: number;
}

/**
 * A question/metric in the pit or match scouting form.
 * @deprecated
 * @collection layout
 * @interface Layout
 */
export declare interface Layout extends DbDocument {
	year: number;
	order: number|string;
	type: 'checkbox'|'counter'|'counterallownegative'|'badcounter'|'slider'|'timeslider'|'multiselect'|'textblock'|'h2'|'h3'|'spacer'|'derived'|'image';
	form_type: 'matchscouting'|'pitscouting';
	org_key: OrgKey;
	label?: string;
	id?: string;
	options?: FormSliderOptions | string[];
}

export interface SchemaItemBase extends DbDocument { }

export interface FormInputItem extends SchemaItemBase {
	label: string;
	id: string;
}

export interface TextBlockItem extends FormInputItem {
	type: 'textblock';
}

export interface CheckBoxItem extends FormInputItem {
	type: 'checkbox';
}

export interface SliderItem extends FormInputItem {
	type: 'slider';
	options: FormSliderOptions;
	variant: 'standard'|'time';
}

export interface CounterItem extends FormInputItem {
	type: 'counter';
	allow_negative: boolean;
	variant: 'standard'|'bad';
}

export interface MultiselectItem extends FormInputItem {
	type: 'multiselect';
	options: string[];
}

export interface HeaderItem extends SchemaItemBase {
	type: 'header';
	label: string;
}

export interface SubheaderItem extends SchemaItemBase {
	type: 'subheader';
	label: string;
}

export interface ImageItem extends SchemaItemBase {
	type: 'image';
	image_id: string;
}

export interface SpacerItem extends SchemaItemBase { 
	type: 'spacer';
}

export type DerivedDisplayType = 'number'|'percentage';

export interface DerivedItemLegacy extends SchemaItemBase {
	type: 'derived';
	operations: DerivedOperation[];
	id: string;
	display_as?: DerivedDisplayType;	
}

export interface DerivedItem extends SchemaItemBase {
	type: 'derived';
	formula: string;
	id: string;
	display_as?: DerivedDisplayType;
}

/**
 * Note: Since some types don't need an id, you may get typescript errors when trying to access the id property.
 * Use e.g. `if ('id' in item)` to check if the item has an id, as that "in" syntax is preferred by TS
 */
export type SchemaItem = TextBlockItem | CheckBoxItem | CounterItem | SliderItem | CounterItem | MultiselectItem | HeaderItem | SubheaderItem | ImageItem | SpacerItem | DerivedItem | DerivedItemLegacy;

/**
 * Sub-object SPR calculation
 */
export declare interface SprCalculation {
	points_per_robot_metric: string;
	subtract_points_from_FRC: {[key: string]: number};
}
/**
 * A pit/match scouting form.
 */
export declare interface Schema extends DbDocument {
	year: number;
	last_modified: Date,
	created: Date,
	form_type: 'matchscouting'|'pitscouting';
	layout: SchemaItem[];
	/** Name of the layout, for future purposes related to sharing schemas */
	name: string;
	/** Long description, for future purposes related to sharing schemas */
	description: string;
	/** For future purposes related to sharing schemas */
	published: boolean;
	/** Org that created the schema, and orgs that are allowed to edit the schema if it's published. */
	owners: OrgKey[];
	/** 2025-02-01, M.O'C: Which SPR calculations to use for the given schema */
	spr_calculation?: SprCalculation;
}

/**
 * Ties an org to a layout key
 * TODO: link org+event instead of just org+year
 */
export declare interface OrgSchema extends DbDocument {
	org_key: OrgKey;
	year: number;
	form_type: 'matchscouting'|'pitscouting';
	/** ID of the item in the Schemas database */
	schema_id: ObjectId;
}

/**
 * @deprecated - now identical to SchemaItem
 */
export declare type LayoutEdit = SchemaItem;

/**
 * A derived metric in the match scouting form.
 * @collection layout
 * @interface DerivedLayout
 * @deprecated
 */
export declare interface DerivedLayoutLegacy extends Layout{
	type: 'derived';
	operations: DerivedOperation[];
	id: string;
	display_as?: string;
}

/**
 * @deprecated
 */
export declare interface DerivedLayout extends Layout {
	type: 'derived';
	formula: string;
	id: string;
	display_as?: string;
}

export declare interface DerivedOperation {
	operator: string;
	as?: string;
}

declare type operand = number|string;

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
	id: string;
}

export declare interface ConditionOperation extends DerivedOperation {
	operator: 'condition';
	operands: [string, string|number|null, string|number|null];
}

export declare interface CompareOperation extends DerivedOperation {
	operator: 'gt'|'gte'|'lt'|'lte'|'eq'|'ne';
	operands: [operand, operand];
}

export declare interface MinMaxOperation extends DerivedOperation {
	operator: 'min'|'max';
	operands: [operand, operand];
}

export declare interface LogOperation extends DerivedOperation {
	operator: 'log';
	operands: [operand, number];
}

export declare interface AbsoluteValueOperation extends DerivedOperation {
	operator: 'abs';
	operands: [operand];
}

/**
 * Data for a match -- From TBA API.
 * @collection matches
 * @interface Match
 */
export declare interface Match extends DbDocument {
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
	videos?: Array<MatchVideo>;
	time: number;
	actual_time: number|'';
	predicted_time: number;
	post_result_time?: number;
	/** Whether the match data was manually entered */
	manually_entered?: boolean;
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
 * Record of who is assigned to / completed a scouting assignment.
 */
export declare interface ScouterRecord {
	/** {@link User}'s _id */
	id: number;
	name: string;
}

/**
 * Record of an edit/submission of a scouting assignment.
 */
export declare interface ScouterHistoryRecord {
	/** {@link User}'s _id */
	id: number;
	name: string;
	/** Exact time that the submission was saved locally. */
	time: Date;
	useragent?: UserAgent;
}

/**
 * Match scouting data & assignments for a given team at a given match.
 * @collection matchscouting
 * @interface MatchScouting
 */
export declare interface MatchScouting extends DbDocument {
	year: number;
	event_key: EventKey;
	org_key: OrgKey;
	match_key: MatchKey;
	match_number: number;
	time: number;
	alliance: 'red' | 'blue';
	team_key: TeamKey;
	match_team_key: MatchTeamKey;
	assigned_scorer?: ScouterRecord;
	actual_scorer?: ScouterRecord;
	data?: MatchFormData;
	super_data?: MatchFormData;
	useragent?: UserAgent;
	/** Update history of this document. For dealing with "merge conflicts" in the future. */
	history?: ScouterHistoryRecord[];
}

/**
 * An organization who uses Scoutradioz.
 * @collection orgs
 * @interface Org
 */
export declare interface Org extends DbDocument {
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
	event_key: EventKey|null;
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
export declare interface OrgTeamValue extends DbDocument {
	org_key: OrgKey;
	team_key: TeamKey;
	picklist_key: string|undefined;
	event_key: EventKey;
	value: number;
}

/**
 * Headers for TBA API calls.
 * @collection passwords
 */
export declare interface TBAApiHeaders extends DbDocument {
	name: 'tba-api-headers';
	headers: StringDict;
}

/**
 * Headers for FIRST API calls.
 * @collection passwords
 */
export declare interface FIRSTApiHeaders extends DbDocument {
	name: 'first-api-headers';
	headers: StringDict;
}

/**
 * Secret key for TBA webhooks
 * @collection passwords
 */
export declare interface TBAWebhookSecret extends DbDocument {
	name: 'tba-webhook-secret';
	secret_key: string;
}

/**
 * Public/private keys for web push API.
 * @collection passwords
 */
export declare interface WebPushKeys extends DbDocument {
	name: 'web_push_keys';
	public_key: string;
	private_key: string;
}

/**
 * Any of the possible items in the passwords collection.
 */
declare type PasswordItem = TBAApiHeaders | FIRSTApiHeaders | TBAWebhookSecret | WebPushKeys;

/**
 * Intended to be a single-entry collection
 */
export declare interface PlatformSettings {
	/** Quick way to enable/disable maintenance mode on the whole site */
	maintenance_mode: boolean;
	/** Most recent update to display, to any user who hasn't seen it yet */
	news: {
		/** unique marker for a device to signify that it already got the message */
		cookie_value: string;
		/** string to display */
		summary: string;
		/** Don't display the news after this date */
		expires: Date;
	}
}

/**
 * Set of scouters for a pit scouting assignment. NOTE: primary/secondary are REQUIRED
 * @collection pitscouting
 * @interface PitScoutingSet
 */
export declare interface PitScoutingSet extends DbDocument {
	primary: ScouterRecord;
	secondary?: ScouterRecord;
	tertiary?: ScouterRecord;
}

/**
 * Pit scouting data & assignments for a given team at a given event. NOTE: primary/secondary/tertiary all optional
 * @collection pitscouting
 * @interface PitScouting
 */
export declare interface PitScouting extends DbDocument {
	year: number;
	event_key: EventKey;
	org_key: OrgKey;
	team_key: TeamKey;
	primary?: ScouterRecord;
	secondary?: ScouterRecord;
	tertiary?: ScouterRecord;
	actual_scouter?: ScouterRecord;
	data?: StringDict;
	super_data?: StringDict;
	useragent?: UserAgent;
	date_completed?: Date;
	/** Update history of this document. For dealing with "merge conflicts" in the future. */
	history?: ScouterHistoryRecord[];
}

/**
 * Contains info for each ranking point for a given year. Manually declared & added each year.
 * The "name" field refers to the key used inside Match.score_breakdown.blue and Match.score_breakdown.red, such as cargoBonusRankingPoint.
 * @collection rankingpoints
 * @interface RankingPoints
 */
export declare interface RankingPoints extends DbDocument {
	year: number;
	attributes: RankingPoint[];
}

export declare interface RankingPoint extends DbDocument {
	label: string;
	name: string;
	abbr: string;
}

/**
 * Identifies a team's ranking at a given event -- From TBA API.
 * @collection rankings
 * @interface Ranking
 */
export declare interface Ranking extends DbDocument {
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
export declare interface Role extends DbDocument {
	role_key: RoleKey;
	label: string;
	access_level: integer;
}

/**
 * From the scoutingpairs collection. Used in pit scouting.
 * @interface ScoutingPair
 */
export declare interface ScoutingPair extends DbDocument {
	member1: ScouterRecord;
	member2?: ScouterRecord;
	member3?: ScouterRecord;
	org_key: OrgKey;
}

/**
 * Handled automatically.
 * @collection sessions
 * @interface Session
 */
export declare interface Session extends DbDocument {
	expires: Date;
	lastModified: Date;
	session: string;
}

/**
 * Session for Lucia package, used within SvelteKit
 * @collection sveltesessions
 * @interface LuciaSession
 */
export declare interface LuciaSession extends DbDocument {
	expiresAt: Date;
	user_id?: number;
    attributes: any;
}

/**
 * Contains a team's 40x40 avatar for a given event year -- From FIRST API.
 * @collection teamavatars
 * @interface TeamAvatar
 */
export declare interface TeamAvatar extends DbDocument {
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
export declare interface Team extends DbDocument {
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
 * Simplified Team info -- from TBA API. Not stored explicitly in the database, but can be achieved through projection in a DB query.
 */
export declare interface TeamSimple extends DbDocument {
	city: string|null;
	country: string|null;
	key: TeamKey;
	name: string;
	nickname: string;
	state_prov: string|null;
	team_number: number;
}

/**
 * Contains info for a user-uploaded image.
 * @collection uploads
 * @interface Upload
 */
export declare interface Upload extends DbDocument {
	org_key: OrgKey;
	year: number;
	team_key: TeamKey;
	image_id: string;
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
export declare interface User extends DbDocumentWithNumberId {
	org_key: OrgKey;
	name: string;
	role_key: RoleKey;
	password: 'default'|'disabled'|string;
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
	oauth: {
		github_id?: number;
	};
	visible: boolean;
	removed: boolean; // New
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

/**
 * Possible collection names in the SR database.
 */
export declare type CollectionName = 'aggranges'|'events'|'i18n'|'layout'|'matches'|'matchscouting'|'orgs'|'orgschemas'|'orgteamvalues'|'passwords'|'pitscouting'|'platformsettings'|'rankingpoints'|'rankings'|'roles'|'schemas'|'scoutingpairs'|'sessions'|'sveltesessions'|'teams'|'uploads'|'users';
/**
 * Gets the correct schema for the given collection name.
 */
export declare type CollectionSchema<colName extends CollectionName> =
	colName extends 'aggranges' ? AggRange :
	colName extends 'events' ? Event :
	// colName extends 'i18n' ?  :
	colName extends 'layout' ? (DerivedLayoutLegacy|Layout|DerivedLayout) :
	colName extends 'matches' ? Match :
	colName extends 'matchscouting' ? MatchScouting :
	colName extends 'orgs' ? Org :
	colName extends 'orgschemas' ? OrgSchema :
	colName extends 'orgteamvalues' ? OrgTeamValue :
	colName extends 'passwords' ? any : // JL: With the way we type-annotate stuff, it's easier to declare items in passwords as 'any' and then just type annotate it because we manually guarantee these guys
	colName extends 'pitscouting' ? PitScouting :
	colName extends 'platformsettings' ? PlatformSettings :
	colName extends 'rankingpoints' ? RankingPoints :
	colName extends 'rankings' ? Ranking :
	colName extends 'roles' ? Role :
	colName extends 'schemas' ? Schema :
	colName extends 'scoutingpairs' ? ScoutingPair :
	colName extends 'sessions' ? Session :
	colName extends 'sveltesessions' ? LuciaSession :
	colName extends 'teams' ? Team :
	colName extends 'uploads' ? Upload :
	colName extends 'users' ? User : 
	any;
/**
 * Gets the correct schema for the given collection name, with a guaranteed `_id` ObjectId.
 */
export declare type CollectionSchemaWithId<colName extends CollectionName> = WithDbId<CollectionSchema<colName>>;

declare let x: CollectionSchema<'layout'>;
