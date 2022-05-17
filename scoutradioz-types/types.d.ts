// JL: Should these be put into a separate package?

import { Document as MongoDocument, ObjectId } from 'mongodb';

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
	assigned_scorer: string;
	actual_scorer?: string;
	data?: AnyDict;
	useragent?: UserAgent;
}

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

declare class MatchVideo {
	type: string;
	key: string;
}

declare class MatchAllianceInfo {
	team_keys: Array<TeamKey>;
	score: number;
	surrogate_team_keys: Array<TeamKey>;
	dq_team_keys: Array<TeamKey>;
}

export declare type RoleKey = 'scouter' | 'viewer' | 'team_admin' | 'global_admin';
export declare type OrgKey = string;
export declare type EventKey = string;
export declare type MatchKey = string;
export declare type MatchTeamKey = string;
export declare type TeamKey = string;
export declare type CompLevel = 'qm' | 'qf' | 'sf' | 'f';
declare type integer = number;

declare interface AnyDict {
	[key: string]: string|number|boolean|null|undefined
}

export declare interface UserAgent {
	ip: string;
	device: string;
	os: string;
	browser: string;
}

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
	role?: Role; // in code, not in db
}

export declare interface Role {
	role_key: RoleKey;
	label: string;
	access_level: integer;
}

export declare interface Org {
	org_key: OrgKey;
	nickname: string;
	team_number?: integer;
	team_numbers?: integer[];
	team_key?: TeamKey;
	team_keys?: TeamKey[];
	default_password: string;
	config: {
		members: {
			subteams: Array<{
				label: string;
				subteam_key: string;
				pit_scout: boolean;
			}>;
			classes: Array<{
				label: string;
				class_key: string;
				seniority: number;
				youth: boolean;
			}>;
		};
		columnDefaults: StringDict;
	}
}

declare interface StringDict {
	[key: string]: string;
}
