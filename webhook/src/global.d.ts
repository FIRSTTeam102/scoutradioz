
declare namespace Express {
	export interface Request {
		tba_secret?: string
	}
}

declare class UpcomingMatch {
	event_key: EventKey;
	match_key: string;
	event_name: string;
	team_keys: Array<string>;
	scheduled_time: number;
	predicted_time: number;
	webcast?: {
		type: string;
		channel: string;
		status: string;
		stream_title: string;
		viewer_count: number;
	};
}

declare class StartingCompLevel {
	comp_level: CompLevel;
	event_key: EventKey;
	event_name: string;
	scheduled_time: number;
}

declare class ScheduleUpdated {
	event_key: EventKey;
	first_match_time: number;
	event_name: string;
}

declare class MatchVideo {
	type: string;
	key: string;
}

declare type EventKey = string;
declare type MatchKey = string;
declare type TeamKey = string;
declare type ScoreBreakdown = any;
declare type CompLevel = 'qm' | 'qf' | 'sf' | 'f';