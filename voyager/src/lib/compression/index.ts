import assert from '$lib/assert';
import type {
	EventLocal,
	LightUser,
	MatchScoutingLocal,
	OrgLocal,
	PitScoutingLocal,
	ScouterRecordLocal,
	TeamLocal,
	str
} from '$lib/localDB';
import db from '$lib/localDB';
import type { Event, ScouterHistoryRecord } from 'scoutradioz-types';
import LZMA from './lzma';

interface PaginatedChecksums {
	users: number;
	teams: number;
}

interface PaginatedMetadata {
	label: string;
	type: string;
	page_size: number;
	current_page: number;
	total_pages: number;
	checksums: PaginatedChecksums;
}

interface PaginatedItem {
	_: PaginatedMetadata;
	data: string;
}

export interface EncodedItem {
	/** Type of data */
	_: string;
}

interface EncodedMatchScouting extends EncodedItem {
	_: 'sched';
	org_key: string;
	event_key: string;
	year: number;
	teams: string;
	firstTime: number;
	scouters: string;
	times: string;
	matchStart: number;
	matchEnd: number;
	matches: string;
	assigned: string;
	actual: string;
	checksum: string;
}

interface EncodedPitScouting extends EncodedItem {
	_: 'pit';
	org_key: string;
	event_key: string;
	year: number;
	groups: string;
	pits: string;
	checksum: string;
}

interface EncodedPitScoutingResults extends EncodedItem {
	_: 'pitresults';
	sched_checksum: string;
	form_checksum: string;
	results: string[];
	scouter: string;
}

interface EncodedMetadata extends EncodedItem {
	_: 'meta';
	org: string;
	teams: string;
	users: string;
	event: string;
}

export let lzma: ReturnType<typeof LZMA>;

export function getLZMA() {
	if (!lzma) {
		lzma = LZMA('/lib/lzma_worker-min.js');
	}
}

function scouterRecordToId(sr: ScouterRecordLocal) {
	return String(sr.id);
}

async function scouterIdToScouterRecord(scouterId: string): Promise<ScouterRecordLocal> {
	let id = parseInt(scouterId);
	assert(!isNaN(id), `Scouter record ${scouterId} is NaN!`);
	let scouter = await db.lightusers.where('_id').equals(id).first();
	if (scouter)
		return {
			id,
			name: scouter.name
		};
	else
		return {
			id,
			name: '(Unknown)'
		};
}

async function stringToTeam(str: string) {
	let key = 'frc' + str;
	let team = await db.teams.where('key').equals(key).first();
	if (!team) {
		throw new Error(
			`Info on team ${key} not found on your device. Scan the "Users & team nicknames" QR code and try again.`
		);
	}
	return {
		team_key: key,
		team_name: team.nickname
	};
}

export function decompress(str: string): Promise<EncodedItem> {
	return new Promise((resolve, reject) => {
		getLZMA(); // Import the LZMA object if it has not been imported yet

		let byteArray = b64decode(str);
		// @ts-ignore
		let lzmaData = byteArray.map((itm) => itm - 128);

		lzma.decompress(
			lzmaData,
			async (result, err) => {
				// try-catch wrapper for the asserts
				if (err) return reject(err);
				try {
					let json: EncodedItem = JSON.parse(result);
					resolve(json);
				} catch (err) {
					reject(err);
				}
			},
			(percent) => {}
		);
	});
}

/**
 * Limitations:
 * 	- Org keys, nicknames, team nicknames, and usernames can't have semicolons
 * 	- Team's full name is ignored, so the decoder will assign nickname and name to be the same
 */
export function encodeMetadata(
	org: OrgLocal,
	users: LightUser[],
	teams: TeamLocal[],
	event: EventLocal
): Promise<string> {
	return new Promise((resolve, reject) => {
		let ret: EncodedMetadata = {
			_: 'meta',
			org: '',
			teams: '',
			users: '',
			event: ''
		};

		// Encode the most critical info of the org (maybe later we can add config too)
		ret.org = [org.org_key, org.nickname, org.event_key, (org.team_numbers || [org.team_number]).join(',')].join(';');

		// Team number and nickname
		ret.teams = teams.map((team) => `${team.team_number}:${team.nickname}`).join(';');

		// User id and name
		ret.users = users
			.map((user) => `${user._id}:${user.name}:${user.role_key}`) // after lzma compression, adding the role_key to the end of each scouter only adds a handful of bytes
			.join(';');

		// Critical event info
		ret.event = `${event.key};${event.name};${event.start_date}:${event.end_date};${event.country};${event.state_prov};${event.event_type}`;

		getLZMA();

		let str = JSON.stringify(ret);
		lzma.compress(str, 9, (result, err) => {
			if (err) return reject(err);
			if (result) {
				let byteArray = result.map((num) => num + 128);
				let base64 = b64encode(byteArray);
				resolve(base64);
			}
		});
	});
}

/**
 * Limitations:
 *  - Present and assigned booleans set to true
 */
export function decodeMetadata(data: EncodedItem) {
	let json = data as EncodedMetadata;

	let orgItems = json.org.split(';');

	let org: OrgLocal = {
		org_key: orgItems[0],
		nickname: orgItems[1],
		config: {
			members: {
				subteams: [], // not needed in local dexie db
				classes: []
			},
			columnDefaults: {}
		},
		event_key: orgItems[2]
	};

	// Decode team_number or team_numbers & team_key or team_keys
	let orgTeamNumbers = orgItems[3].split(',').map((str) => parseInt(str));
	if (orgTeamNumbers.length === 1) {
		org.team_number = orgTeamNumbers[0];
		org.team_key = 'frc' + org.team_number;
	} else {
		org.team_numbers = orgTeamNumbers;
		org.team_keys = orgTeamNumbers.map((number) => 'frc' + number);
	}

	let userStrings = json.users.split(';');
	let teamStrings = json.teams.split(';');

	let users: LightUser[] = [];
	let teams: TeamLocal[] = [];
	let team_keys: string[] = [];

	for (let user of userStrings) {
		let [idString, name, role_key] = user.split(':');
		let _id = parseInt(idString);
		assert(!isNaN(_id), `_id (original string is ${idString}) is NaN!`);
		users.push({
			_id,
			org_key: org.org_key,
			name,
			role_key,
			event_info: {
				present: true,
				assigned: true
			}
		});
	}

	for (let team of teamStrings) {
		let split = team.split(':');
		let [team_number, name] = team.split(':');
		teams.push({
			city: null,
			country: null,
			key: 'frc' + team_number,
			name,
			nickname: name,
			state_prov: null,
			team_number: parseInt(team_number)
		});
		team_keys.push('frc' + split[0]);
	}

	// Event
	let event: EventLocal;
	{
		let [key, name, start_date, end_date, country, state_prov, event_type] = json.event.split(';');
		let year = parseInt(key.substring(0, 4));
		let event_code = key.substring(4);
		event = {
			city: null,
			country,
			district: null,
			end_date,
			event_code,
			event_type: parseInt(event_type),
			key,
			name,
			start_date,
			state_prov,
			year,
			team_keys,
			timezone: null
		};
	}

	return {
		org,
		users,
		teams,
		event
	};
}

export async function encodePitScouting(data: PitScoutingLocal[], checksum: string): Promise<string> {
	return new Promise((resolve, reject) => {
		assert(data.length, 'array is empty!');

		let ret: EncodedPitScouting = {
			_: 'pit',
			org_key: data[0].org_key,
			event_key: data[0].event_key,
			year: data[0].year,
			groups: '',
			pits: '',
			checksum: checksum.substring(0, 3)
		};

		let groups: ScouterRecordLocal[][] = [];
		let pits: string[] = []; // 102,0;41,2, ...

		for (let assignment of data) {
			// Find the scouting group that has been assigned this team
			let scouterGroupIndex = groups.findIndex((group) =>
				group.some((scouter) => scouter.id === assignment.primary?.id)
			);
			// Add the scouting group if it hasn't been added yet (order does not matter)
			if (scouterGroupIndex === -1) {
				let thisRecordGroup: ScouterRecordLocal[] = [];
				if (assignment.primary) thisRecordGroup.push(assignment.primary);
				if (assignment.secondary) thisRecordGroup.push(assignment.secondary);
				if (assignment.tertiary) thisRecordGroup.push(assignment.tertiary);
				if (thisRecordGroup.length > 0) {
					groups.push(thisRecordGroup);
					scouterGroupIndex = groups.length - 1;
				}
			}
			pits.push(`${assignment.team_key.substring(3)},${assignment.primary?.id || -1}`);
		}

		ret.pits = pits.join(';');
		// 1,2,3;4,5,6; ...
		ret.groups = groups.map((group) => group.map(scouterRecordToId).join(',')).join(';');

		let str = JSON.stringify(ret);
		getLZMA();
		lzma.compress(str, 9, (result, err) => {
			if (err) return reject(err);
			if (result) {
				// lzma's result varies from -128 to 127
				let byteArray = result.map((num) => num + 128);
				let base64 = b64encode(byteArray);
				resolve(base64);
			}
		});
	});
}

export async function decodePitScouting(data: EncodedItem) {
	let json = data as EncodedPitScouting;

	// Reassemble 2d array of scouting groups
	let scoutingGroupsIds = json.groups.split(';').map((str) => str.split(','));
	let scoutingGroups: ScouterRecordLocal[][] = [];
	for (let i in scoutingGroupsIds) {
		scoutingGroups[i] = [];
		for (let j in scoutingGroupsIds[i]) {
			scoutingGroups[i].push(await scouterIdToScouterRecord(scoutingGroupsIds[i][j]));
		}
	}
	let pitStrings = json.pits.split(';');

	let pitscouting: PitScoutingLocal[] = [];

	for (let string of pitStrings) {
		let [teamNum, primaryId] = string.split(',');
		let primary: ScouterRecordLocal | undefined;
		let secondary: ScouterRecordLocal | undefined;
		let tertiary: ScouterRecordLocal | undefined;
		if (primaryId != '-1') primary = await scouterIdToScouterRecord(primaryId);
		// Find the scouting group
		let scouterGroup = scoutingGroups.find((group) => group.some((scouter) => scouter.id === primary?.id));
		// This is SO un-elegant, but I couldn't think of a better way to do this
		// Populate secondary and tertiary from the scouter group array
		if (scouterGroup) {
			assert(primary, `Scouter group was defined but primary is not defined? Group=${JSON.stringify(scouterGroup)}`);
			for (let scouter of scouterGroup) {
				if (!secondary && scouter.id !== primary.id) {
					secondary = scouter;
					continue;
				}
				if (secondary && !tertiary && scouter.id !== primary.id && scouter.id !== secondary.id) {
					tertiary = scouter;
					continue;
				}
			}
		}

		pitscouting.push({
			year: json.year,
			event_key: json.event_key,
			org_key: json.org_key,
			team_key: 'frc' + teamNum,
			primary,
			secondary,
			tertiary,
			synced: false,
			completed: false
		});
	}

	return {
		pitscouting,
		checksum: json.checksum
	};
}

/**
 * Limitations:
 * 	- Only one org_key, year, and event_key allowed
 *  - Assumes matches are contiguous
 *  - Max of 100 scouters and 100 teams
 *  - assumes matches are sorted by time
 */
export function encodeMatchScoutingSchedule(data: MatchScoutingLocal[], checksum: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let ret: EncodedMatchScouting = {
			_: 'sched',
			org_key: data[0].org_key,
			event_key: data[0].event_key,
			year: data[0].year,
			teams: '',
			scouters: '',
			firstTime: data[0].time,
			times: '',
			matchStart: data[0].match_number,
			matchEnd: data[data.length - 1].match_number,
			matches: '', // List of team keys per match, [blue blue blue red red red], broken by match via ';'
			assigned: '', // List of assigned_scorer ids
			actual: '', // List of actual_scorer ids
			checksum: checksum.substring(0, 3)
		};

		// find list of unique scouter ids and teams
		let scouters: string[] = [];
		let teams: string[] = [];

		for (let assignment of data) {
			if (assignment.actual_scorer) {
				let actual_scorer = scouterRecordToId(assignment.actual_scorer);
				if (!scouters.includes(actual_scorer)) scouters.push(actual_scorer);
			}
			if (assignment.assigned_scorer) {
				let assigned_scorer = scouterRecordToId(assignment.assigned_scorer);
				if (!scouters.includes(assigned_scorer)) scouters.push(assigned_scorer);
			}
			// let team = assignment.team_key.substring(3) + ':' + (assignment.team_name || '');
			let team = assignment.team_key.substring(3);
			if (!teams.includes(team)) teams.push(team);
		}

		assert(scouters.length < 100, 'There can only be up to 100 scouters!');
		assert(teams.length < 100, 'There can only be up to 100 teams!');

		scouters.sort();
		teams.sort(); // String-based sort should be fine in this case, since it's just an index map

		ret.teams = teams.join(';');
		ret.scouters = scouters.join(';');

		// Group by match key
		let groupedByMatch: MatchScoutingLocal[][] = Object.values(
			data.reduce((grouped: { [key: string]: any }, match) => {
				grouped[match.match_key] = grouped[match.match_key] || [];
				grouped[match.match_key].push(match);
				return grouped;
			}, {})
		);

		let matchTeamKeyList: string[] = [];
		let assignedScorerList: string[] = [];
		let actualScorerList: string[] = [];
		let timeList: string[] = [];

		for (let group of groupedByMatch) {
			let thisTeamList: string[] = [];
			let thisAssignedList: string[] = [];
			let thisActualScorerList: string[] = [];
			group.sort((a, b) => a.alliance.localeCompare(b.alliance)); // Sort to guarantee that blue alliance comes first
			group.forEach((item) => {
				// let thisTeam = item.team_key.substring(3) + ':' + (item.team_name || '');
				let thisTeam = item.team_key.substring(3);
				let thisAssigned = item.assigned_scorer ? scouterRecordToId(item.assigned_scorer) : undefined;
				let thisActualScorer = item.actual_scorer ? scouterRecordToId(item.actual_scorer) : undefined;

				let thisTeamIdx = String(teams.indexOf(thisTeam)).padStart(2, '0');
				let thisAssignedIdx = thisAssigned ? scouters.indexOf(thisAssigned).toString().padStart(2, '0') : '|'; // put a pipe if there's no scouter in the map
				let thisActualScorerIdx = thisActualScorer
					? scouters.indexOf(thisActualScorer).toString().padStart(2, '0')
					: '|';

				assert(
					thisAssignedIdx !== '-1' && thisActualScorerIdx !== '-1' && thisTeamIdx !== '-1',
					'Something went wrong with the indexing'
				);

				thisTeamList.push(thisTeamIdx);
				thisAssignedList.push(thisAssignedIdx);
				thisActualScorerList.push(thisActualScorerIdx);
			});
			matchTeamKeyList.push(thisTeamList.join(''));
			assignedScorerList.push(thisAssignedList.join(''));
			actualScorerList.push(thisActualScorerList.join(''));
			timeList.push(((group[0].time - ret.firstTime) / 60).toString()); // add time stored in base 36 (highest base allowed by JS)
		}
		ret.matches = matchTeamKeyList.join(';');
		ret.assigned = assignedScorerList.join(';');
		ret.actual = actualScorerList.join(';');
		ret.times = timeList.join(';');

		getLZMA(); // Import the LZMA object if it has not been imported yet

		let str = JSON.stringify(ret);
		lzma.compress(
			str,
			9,
			(result, err) => {
				if (err) return reject(err);
				if (result) {
					// lzma's result varies from -128 to 127
					let byteArray = result.map((num) => num + 128);
					let base64 = b64encode(byteArray);
					resolve(base64);
				}
			},
			(percent) => {}
		);
	});
}

/**
 * Limitations:
 * 	- assumes qualifying matches only
 */
export async function decodeMatchScoutingSchedule(data: EncodedItem) {
	let json = data as EncodedMatchScouting;

	let scouterStrings = json.scouters.split(';');
	let teamNumbers = json.teams.split(';');

	let teamStrings = json.matches.split(';');
	let assignedStrings = json.assigned.split(';');
	let actualScorerStrings = json.actual.split(';');

	let timeStrings = json.times.split(';');

	assert(
		teamStrings.length === assignedStrings.length && teamStrings.length === actualScorerStrings.length,
		'Length mismatch!'
	);

	let decodedMatchScouting: MatchScoutingLocal[] = [];

	// loop through each match
	for (let i = 0; i < teamStrings.length; i++) {
		let thisTeamStrs = teamStrings[i]; // list of team indexes
		let thisAssignedStrs = assignedStrings[i]; // list of assigned scouter indexes
		let thisActualStrs = actualScorerStrings[i]; // list of actual scouter indexes

		let teams: Awaited<ReturnType<typeof stringToTeam>>[] = [];
		for (let j = 0; j < 12; j += 2) {
			let thisTeamIdx = parseInt(thisTeamStrs.substring(j, j + 2));
			let thisTeamStr = teamNumbers[thisTeamIdx];
			assert(thisTeamStr, 'team could not be found in list!');
			teams.push(await stringToTeam(thisTeamStr));
		}
		let assignedScouters: (ScouterRecordLocal | undefined)[] = [];
		// if it starts with a | then there was no scouter for this matchteam, otherwise it's the 2 digit index
		while (thisAssignedStrs.length > 0) {
			let thisSubstr = thisAssignedStrs.substring(0, 2);
			// No one assigned
			if (thisSubstr.startsWith('|')) {
				assignedScouters.push(undefined);
				thisAssignedStrs = thisAssignedStrs.substring(1); // chop off the |
			}
			// Someone assigned
			else {
				let thisScouterIdx = parseInt(thisSubstr);
				let thisAssigned = await scouterIdToScouterRecord(scouterStrings[thisScouterIdx]);
				assignedScouters.push(thisAssigned);
				thisAssignedStrs = thisAssignedStrs.substring(2); // chop off the 2 digits
			}
		}
		// Do the same thing as above, but for actual_scorer
		let actualScouters: typeof assignedScouters = [];
		while (thisActualStrs.length > 0) {
			let thisSubstr = thisActualStrs.substring(0, 2);
			if (thisSubstr.startsWith('|')) {
				actualScouters.push(undefined);
				thisActualStrs = thisActualStrs.substring(1);
			} else {
				let thisScouterIdx = parseInt(thisSubstr);
				let thisActual = await scouterIdToScouterRecord(scouterStrings[thisScouterIdx]);
				actualScouters.push(thisActual);
				thisActualStrs = thisActualStrs.substring(2);
			}
		}

		let match_number = i + json.matchStart; // i is index in the list, matchStart is the match number of the starting match
		let match_key = `${json.event_key}_qm${match_number}`;

		let time = parseInt(timeStrings[i]) * 60 + json.firstTime;

		for (let j = 0; j < 6; j++) {
			let { team_key, team_name } = teams[j];
			let match_team_key = `${match_key}_${team_key}`;
			let thisMatchTeam: MatchScoutingLocal = {
				year: json.year,
				event_key: json.event_key,
				org_key: json.org_key,
				match_key,
				match_number,
				time,
				alliance: j < 3 ? 'blue' : 'red',
				team_key,
				match_team_key,
				team_name
			};
			if (assignedScouters[j]) thisMatchTeam.assigned_scorer = assignedScouters[j];
			if (actualScouters[j]) thisMatchTeam.actual_scorer = actualScouters[j];
			decodedMatchScouting.push(thisMatchTeam);
		}
	}

	assert(
		decodedMatchScouting[decodedMatchScouting.length - 1].match_number === json.matchEnd,
		'Last match_number does not match what was reported in the json! Were the matches not contiguous?'
	); // validation

	return {
		matchscouting: decodedMatchScouting,
		checksum: json.checksum
	};
}

// export async function encodeBulkPitScoutingResults(entry: PitScoutingLocal[]): Promise<string> {
// 	return new Promise((resolve, reject) => {
// 		let str = JSON.stringify({
// 			_: '1pitdata',
// 			as: entry.actual_scouter,
// 			data: entry.data,
// 			org: entry.org_key,
// 			event: entry.event_key,
// 			key: entry.team_key,
// 			c: entry.completed ? 1 : 0,
// 			s: entry.synced ? 1 : 0,
// 			history: entry.history,
// 		});

// 		getLZMA();
// 		lzma.compress(str, 9, (result, err) => {
// 			if (err) return reject(err);
// 			if (result) {
// 				let byteArray = result.map((num) => num + 128);
// 				let base64 = b64encode(byteArray);
// 				resolve(base64);
// 			}
// 		});
// 	});
// }

// export async function decodeBulkPitScoutingResults(data: EncodedItem) {
// 	let json = data as {
// 		_: '1pitdata';
// 		as: ScouterRecordLocal; // actual_scorer
// 		data: PitScoutingLocal['data'];
// 		org: string;
// 		event: string;
// 		key: string;
// 		c: number;
// 		s: number;
// 		history?: ScouterHistoryRecord;
// 	};
// 	return {
// 		type: '1pitdata',
// 		label: `Pit scouting result: ${json.key} scouted by ${json.as?.name}`,
// 		data: {
// 			actual_scouter: json.as,
// 			data: json.data,
// 			org_key: json.org,
// 			event_key: json.event,
// 			team_key: json.key,
// 			// 1 is truthy, 0 is falsy
// 			completed: !!json.c,
// 			synced: !!json.s,
// 			history: json.history,
// 		}
// 	};
// }

export async function encodeOneMatchScoutingResult(entry: MatchScoutingLocal): Promise<string> {
	return new Promise((resolve, reject) => {
		let str = JSON.stringify({
			_: '1matchdata',
			as: entry.actual_scorer,
			data: entry.data,
			mtc: entry.match_team_key,
			c: entry.completed ? 1 : 0,
			s: entry.synced ? 1 : 0,
			history: entry.history
		});

		getLZMA();
		lzma.compress(str, 9, (result, err) => {
			if (err) return reject(err);
			if (result) {
				let byteArray = result.map((num) => num + 128);
				let base64 = b64encode(byteArray);
				resolve(base64);
			}
		});
	});
}

export async function decodeOneMatchScoutingResult(data: EncodedItem) {
	let json = data as {
		_: '1matchdata';
		as: ScouterRecordLocal; // actual_scorer
		data: MatchScoutingLocal['data'];
		mtc: string; // match team key
		c: number; // completed (1 for true, 0 for false)
		s: number; // synced (1 for true, 0 for false)
		history?: ScouterHistoryRecord;
	};
	let match_team_key = json.mtc;
	let split = match_team_key.split('_');
	let match_key = split.slice(0, 2).join('_');
	let match_number = parseInt(split[1].substring(2));
	return {
		actual_scorer: json.as,
		data: json.data,
		match_team_key: json.mtc,
		// 1 is truthy, 0 is falsy
		completed: !!json.c,
		synced: !!json.s,
		history: json.history,
		match_key,
		match_number,
	};
}

export async function encodeOnePitScoutingResult(entry: PitScoutingLocal): Promise<string> {
	return new Promise((resolve, reject) => {
		let str = JSON.stringify({
			_: '1pitdata',
			as: entry.actual_scouter,
			data: entry.data,
			org: entry.org_key,
			event: entry.event_key,
			key: entry.team_key,
			c: entry.completed ? 1 : 0,
			s: entry.synced ? 1 : 0,
			history: entry.history
		});

		getLZMA();
		lzma.compress(str, 9, (result, err) => {
			if (err) return reject(err);
			if (result) {
				let byteArray = result.map((num) => num + 128);
				let base64 = b64encode(byteArray);
				resolve(base64);
			}
		});
	});
}

export async function decodeOnePitScoutingResult(data: EncodedItem) {
	let json = data as {
		_: '1pitdata';
		as: ScouterRecordLocal; // actual_scorer
		data: PitScoutingLocal['data'];
		org: string;
		event: string;
		key: string;
		c: number;
		s: number;
		history?: ScouterHistoryRecord;
	};
	return {
		actual_scouter: json.as,
		data: json.data,
		org_key: json.org,
		event_key: json.event,
		team_key: json.key,
		// 1 is truthy, 0 is falsy
		completed: !!json.c,
		synced: !!json.s,
		history: json.history
	} as PitScoutingLocal;
}

function b64encode(x: number[]) {
	return btoa(
		x
			.map(function (v) {
				return String.fromCharCode(v);
			})
			.join('')
	);
}
function b64decode(x: string) {
	// @ts-ignore
	return atob(x)
		.split('')
		.map(function (v) {
			return v.codePointAt(0);
		});
}
