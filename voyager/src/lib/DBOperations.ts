import { get as getStore } from 'svelte/store';
import { page } from '$app/stores';
import { base32Hash, fetchJSON, getNewSubmissionHistory } from './utils';
import { getLogger } from './logger';
import type { Layout, Event, OrgSchema, Schema, OrgKey, EventKey, Upload } from 'scoutradioz-types';
import type {
	MatchScoutingLocal,
	TeamLocal,
	WithStringDbId,
	LightMatch,
	str,
	PitScoutingLocal,
	LightOrg,
	LightUser,
	UploadLocal,
	SchemaLocal
} from './localDB';
import db from './localDB';
import assert from './assert';
import type { ImageLinks } from 'scoutradioz-helpers/types/uploadhelper';

/** Get org_key and event_key from $page.data */
function getKeys() {
	let { event_key, org_key } = getStore(page).data;
	if (!event_key || !org_key) throw new Error('event_key and org_key not set!');
	return { event_key, org_key };
}

const logger = getLogger('lib/DBOperations');

export const DEFAULT_SYNC_AGE_THRESHOLD = 1000 * 3600 * 24 * 7; // 1 week

abstract class TableOperations {
	/** Download from the API endpoint */
	static download(...args: any[]) {
		throw new Error('Not implemented');
	}
	/** Check if the given table is out of date and needs a sync */
	static needsSync(...args: any[]) {
		throw new Error('Not implemented');
	}
	/** Upload completed data */
	static upload(...args: any[]) {
		throw new Error('Not implemented');
	}
}

export class EventOperations extends TableOperations {
	static async download() {
		const { event_key } = getKeys();

		const event = await fetchJSON<str<Event>>(`/api/${event_key}`);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.events, db.syncstatus, async () => {
			await db.events.put(event);
			await db.syncstatus.put({
				table: 'events',
				filter: `event=${event_key}`,
				time: new Date()
			});
		});
		logger.trace('Done');
	}
}

export class TeamOperations extends TableOperations {
	@setFuncName('TeamOperations.download')
	static async download() {
		const { event_key } = getKeys();

		const teams = await fetchJSON<TeamLocal[]>(`/api/${event_key}/teams`);
		logger.debug(`Retrieved ${teams.length} teams from api`);

		// Clear teams
		logger.trace('Begin transaction');
		await db.transaction('rw', db.events, db.teams, db.syncstatus, async () => {
			const event = await db.events.where({ key: event_key }).first();
			assert(event, 'Event not found in local db');

			logger.info(`Inserted ${teams.length} into db`);
			await db.teams.bulkPut(teams);
			await db.syncstatus.put({
				table: 'teams',
				filter: `event=${event_key}`,
				time: new Date()
			});
		});
		logger.trace('Done');
	}
}

export class MatchOperations extends TableOperations {
	@setFuncName('MatchOperations.download')
	static async download() {
		const { event_key } = getKeys();

		const matches = await fetchJSON<LightMatch[]>(`/api/${event_key}/matches`);
		logger.debug(`Retrieved ${matches.length} matches from api`);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.lightmatches, db.syncstatus, async () => {
			let numDeleted = await db.lightmatches.where({ event_key }).delete();
			logger.debug(`${numDeleted} matches deleted from db`);
			await db.lightmatches.bulkAdd(matches);
			await db.syncstatus.put({
				table: 'lightmatches',
				filter: `event=${event_key}`,
				time: new Date()
			});
		});
	}
}

export class MatchScoutingOperations extends TableOperations {
	@setFuncName('MatchScoutingOperations.download')
	static async download() {
		const { event_key, org_key } = getKeys();

		const filter = `org=${org_key},event=${event_key}`;
		const syncstatus = await db.syncstatus
			.where({
				table: 'matchscouting',
				filter
			})
			.first();

		// Fetch list of match scouting assignments for this event
		const matchScouting = await fetchJSON<MatchScoutingLocal[]>(`/api/orgs/${org_key}/${event_key}/assignments/match`);

		// Timestamps will get stringified, so make sure to convert them back into dates
		matchScouting.forEach(item => item.history?.forEach(entry => entry.time = new Date(entry.time)));

		// Merge with existing data
		const localMatchScouting = await db.matchscouting.where({ org_key, event_key }).toArray();
		const mergedMatchScouting = await MatchScoutingOperations.merge(matchScouting, localMatchScouting);

		const checksum = await MatchScoutingOperations.getChecksum(mergedMatchScouting);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.matchscouting, db.syncstatus, async () => {
			await db.matchscouting.bulkPut(mergedMatchScouting);
			await db.syncstatus.put({
				table: 'matchscouting',
				filter,
				time: new Date(),
				data: {
					checksum,
					source: 'download'
				}
			});
		});

		let changed = true;
		if (typeof syncstatus?.data?.checksum === 'string')
			changed = syncstatus.data.checksum.substring(3) !== checksum.substring(3);
		logger.debug(`Newly calculated checksum: ${checksum}. Changed=${changed}`);

		logger.trace('Done');
		return changed;
	}

	/**
	 * "Enrich" the new assignments/etc that were just downloaded/scanned with data that's on the local db
	 * @param newItems The new items that were just downloaded/scanned
	 * @param oldItems The existing items in the local database
	 */
	static async merge(newItems: MatchScoutingLocal[], oldItems: MatchScoutingLocal[]) {
		// 2024-02-03, M.O'C: Handling not overwriting un-commited data!!!
		let keyToIndex: { [key: string]: number } = {};
		if (newItems && newItems.length > 0)
			for (let i = 0; i < newItems.length; i++) {
				let thisObj = newItems[i];
				keyToIndex[thisObj.match_team_key] = i;
			}

		// JL: Sometimes the remote db has data === null and not undefined, and I think this
		// 	breaks the export let formData = {} stuff
		for (let match of newItems) if (match.data === null) match.data = undefined;

		// TODO (IMPORTANT) also copy over synced and completed booleans, and maybe compare the history states
		// 	Need some more robust logic for edge cases
		for (let localMatch of oldItems) {
			if (localMatch.data) {
				let this_match_team_key = localMatch.match_team_key;
				let index = keyToIndex[this_match_team_key];
				// If there exists entries in both, then perform a merge
				if (index && newItems[index]) {
					console.log(newItems[index], localMatch);
					newItems[index] = await mergeScoutingEntry(newItems[index], localMatch);
				}
			}
		}

		return [...newItems];
	}

	@setFuncName('MatchScoutingOperations.insertFromQR')
	static async insertFromQR(newMatchScouting: MatchScoutingLocal[], checksum: string) {
		assert(newMatchScouting.length > 0);
		const { org_key, event_key } = newMatchScouting[0];

		logger.info(`Inserting ${newMatchScouting.length} documents with org_key=${org_key}, event_key=${event_key}`);

		// Merge with existing data
		const localMatchScouting = await db.matchscouting.where({ org_key, event_key }).toArray();
		const mergedMatchScouting = await MatchScoutingOperations.merge(newMatchScouting, localMatchScouting);

		logger.debug('mergedMatchScouting:', mergedMatchScouting);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.matchscouting, db.syncstatus, async () => {
			await db.matchscouting.where({ org_key, event_key }).delete();
			await db.matchscouting.bulkPut(mergedMatchScouting);
			await db.syncstatus.put({
				table: 'matchscouting',
				filter: `org=${org_key},event=${event_key}`,
				time: new Date(),
				data: {
					checksum,
					source: 'qr'
				}
			});
		});
		logger.trace('Done');
	}

	@setFuncName('MatchScoutingOperations.getChecksum')
	static async getChecksum(items: MatchScoutingLocal[]) {
		const listToChecksum = items.map((asg) => {
			return {
				year: asg.year,
				event_key: asg.event_key,
				org_key: asg.org_key,
				match_key: asg.match_key,
				match_number: asg.match_number,
				time: asg.time,
				alliance: asg.alliance,
				team_key: asg.team_key,
				match_team_key: asg.match_team_key,
				assigned_scorer: asg.assigned_scorer
			};
		});
		logger.debug(JSON.stringify(listToChecksum));

		// Checksum for comparing schedules
		const checksum = await base32Hash(JSON.stringify(listToChecksum));
		logger.debug(`Checksum: ${checksum}`);
		return checksum;
	}
}

export class PitScoutingOperations extends TableOperations {
	@setFuncName('PitScoutingOperations.download')
	static async download() {
		logger.info('ENTER');
		const { event_key, org_key } = getKeys();

		const syncstatus = await db.syncstatus
			.where({
				table: 'pitscouting',
				filter: `org=${org_key},event=${event_key}`
			})
			.first();

		// we must convert strings to numbers since pit scouting are stored as strings, unfortunately
		const { layout } = await SchemaOperations.getSchemaForOrgAndEvent(org_key, event_key, 'pitscouting');
		assert(layout, 'Schema must be downloaded before downloading pit scouting assignments');

		// Fetch list of pit scouting assignments for this event
		const pitScouting = await fetchJSON<PitScoutingLocal[]>(`/api/orgs/${org_key}/${event_key}/assignments/pit`);

		// Timestamps will get stringified, so make sure to convert them back into dates
		pitScouting.forEach(item => item.history?.forEach(entry => entry.time = new Date(entry.time)));

		// let numericalFields = 

		console.log(pitScouting.find(item => item.team_key === 'frc11'));

		const localPitScouting = await db.pitscouting.where({ org_key, event_key }).toArray();
		const mergedPitScouting = await PitScoutingOperations.merge(pitScouting, localPitScouting);
		const checksum = await PitScoutingOperations.getChecksum(mergedPitScouting);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.pitscouting, db.syncstatus, async () => {
			let putResult = await db.pitscouting.bulkPut(mergedPitScouting);
			logger.debug('result frum pitscouting bulkPut:', putResult)
			await db.syncstatus.put({
				table: 'pitscouting',
				filter: `org=${org_key},event=${event_key}`,
				time: new Date(),
				data: {
					checksum,
					source: 'download'
				}
			});
		});

		let changed = true;
		if (typeof syncstatus?.data?.checksum === 'string')
			changed = syncstatus.data.checksum.substring(3) !== checksum.substring(3);
		logger.debug(`Newly calculated checksum: ${checksum}. Changed=${changed}`);

		logger.trace('Done');
		return changed;
	}

	/**
	 * "Enrich" the new assignments/etc that were just downloaded/scanned with data that's on the local db
	 * @param newItems The new items that were just downloaded/scanned
	 * @param oldItems The existing items in the local database
	 */
	static async merge(newItems: PitScoutingLocal[], oldItems: PitScoutingLocal[]) {
		// 2024-02-03, M.O'C: Handling not overwriting un-commited data!!!
		let keyToIndex: { [key: string]: number } = {};
		if (newItems && newItems.length > 0)
			for (let i = 0; i < newItems.length; i++) {
				let thisObj = newItems[i];
				keyToIndex[thisObj.team_key] = i;
			}

		// JL: Sometimes the remote db has data === null and not undefined, and I think this
		// 	breaks the export let formData = {} stuff
		for (let match of newItems) if (match.data === null) match.data = undefined;

		// TODO (IMPORTANT) also copy over synced and completed booleans, and maybe compare the history states
		for (let localPit of oldItems) {
			if (localPit.data) {
				let thisTeamKey = localPit.team_key;
				let index = keyToIndex[thisTeamKey];
				// If there exists entries in both, then perform a merge
				if (index && newItems[index]) {
					newItems[index] = await mergeScoutingEntry(newItems[index], localPit);
				}
			}
		}

		return [...newItems];
	}

	@setFuncName('PitScoutingOperations.insertFromQR')
	static async insertFromQR(newPitScouting: PitScoutingLocal[], checksum: string) {
		assert(newPitScouting.length > 0);
		const { org_key, event_key } = newPitScouting[0];

		logger.info(`Inserting ${newPitScouting.length} documents with org_key=${org_key}, event_key=${event_key}`);

		const localPitScouting = await db.pitscouting.where({ org_key, event_key }).toArray();
		const mergedPitScouting = await PitScoutingOperations.merge(newPitScouting, localPitScouting);

		logger.debug('mergedPitScouting:', mergedPitScouting);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.pitscouting, db.syncstatus, async () => {
			await db.pitscouting.where({ org_key, event_key }).delete();
			await db.pitscouting.bulkPut(mergedPitScouting);
			await db.syncstatus.put({
				table: 'pitscouting',
				filter: `org=${org_key},event=${event_key}`,
				time: new Date(),
				data: {
					checksum,
					source: 'qr'
				}
			});
		});
		logger.trace('Done');
	}

	static async getChecksum(items: PitScoutingLocal[]) {
		// 2024-02-09 JL: Add a checksum to the pit scouting schedule, stored in syncstatus
		// 	(it takes like 200ms on my PC to calculate the checksum, so we shouldn't do it on-the-fly in the dashboard)
		const listToChecksum = items.map((asg) => {
			return {
				year: asg.year,
				event_key: asg.event_key,
				org_key: asg.org_key,
				team_key: asg.team_key,
				primary: asg.primary,
				secondary: asg.secondary,
				tertiary: asg.tertiary
			};
		});
		const checksum = await base32Hash(JSON.stringify(listToChecksum));
		logger.debug(`Checksum: ${checksum}`);
		return checksum;
	}
}

/**
 * When both entries have data, perform a merge based no our best inference of which data to prefer
 * @param incoming Incoming entry, i.e. downloaded from cloud
 * @param current Existing entry, i.e. local from Dexie
 * @returns Merged entry
 */
async function mergeScoutingEntry<T extends PitScoutingLocal | MatchScoutingLocal>(incoming: T, current: T): Promise<T> {
	function preferIncoming() {
		return { ...incoming };
	}
	function preferCurrent() {
		let merged = { ...incoming };
		merged.data = current.data;
		merged.synced = current.synced;
		merged.completed = current.completed;
		merged.history = current.history;
		return merged;
	}
	if (current.history && !incoming.history) return preferCurrent(); // current has history and incoming does not: prefer current
	if (incoming.history && !current.history) return preferIncoming(); // opposite case to above
	if (!current.history || !incoming.history || current.history.length === 0 || incoming.history.length === 0) {
		logger.warn('mergeScoutingEntry: Neither entry has a history attribute or has history length 0.');
		let merged = incoming.data ? preferIncoming() : preferCurrent(); // Prefer incoming if incoming has data; current otherwise.
		// Create a new history record for this merge
		let user = await db.user.toCollection().first();
		assert(user && user.name !== 'default_user', 'Not logged in!');
		merged.history = getNewSubmissionHistory(merged, user._id, user.name);
		return merged;
	}
	// Both have history? Compare histories one by one
	let maxN = Math.max(incoming.history.length, incoming.history.length);
	for (let i = 0; i < maxN; i++) {
		let thisIncoming = incoming.history[i];
		let thisCurrent = current.history[i];
		if (thisIncoming && !thisCurrent) return preferIncoming(); // If we get to this step, then history matches all the way up to current, but incoming has one more in the stack
		if (thisCurrent && !thisIncoming) return preferCurrent(); // If we get to this step, then history matches all the way up to incoming, but current has one more in the stack
		// Check if they match
		let incomingDate = new Date(thisIncoming.time), currentDate = new Date(thisIncoming.time); // JL note: i'd prefer to assert with the line below, but in my testing i had an un-cast date string in dexie, so just to cover that possibility we can typecast here
		// assert(thisIncoming.time instanceof Date && thisCurrent.time instanceof Date, 'Timestamps are not Date type! Did they not get re-typecast after downloading?');
		let doDatesMatch = Math.abs(incomingDate.valueOf() - currentDate.valueOf()) < 5_000; // 5 seconds apart: effectively same timestamp
		if (doDatesMatch && thisIncoming.id === thisCurrent.id && thisIncoming.name === thisCurrent.name) continue; // If they match, then proceed to next item in history
		// If they don't match, prefer the one with the LATEST timestamp
		if (currentDate > incomingDate) {
			logger.warn('Conflicting histories. "Current" has later timestamp, so it will be prioritized. Discarded entry:', incoming);
			return preferCurrent(); // todo: what will happen server side? when this is uploaded, it'll still think there's a conflict since we haven't spliced the old history onto the new
		}
		if (incomingDate > currentDate) {
			logger.warn('Conflicting histories. "Incoming" has later timestamp, so it will be prioritized. Discarded entry:', current);
			return preferIncoming(); // todo: what will happen server side? when this is uploaded, it'll still think there's a conflict since we haven't spliced the old history onto the new
		}
	}
	logger.error('Failed to identify which entry to prioritize based on history entries. Prioritizing incoming. Discarded entry:', current);
	return preferIncoming();
}

export class SchemaOperations extends TableOperations {
	@setFuncName('SchemaOperations.download')
	static async download(type: 'match' | 'pit' | 'both' = 'both') {
		const { event_key, org_key } = getKeys();

		const doPit = type === 'pit' || type === 'both';
		const doMatch = type === 'match' || type === 'both';
		logger.info(`ENTER, downloading ${type}`);

		// grab year from event key
		const year = Number(event_key.substring(0, 4));
		assert(!isNaN(year), `Failed to pull year from event_key: ${event_key}, got a NaN!`);

		let matchChanged = false,
			pitChanged = false;

		async function doDownload(form_type: 'matchscouting' | 'pitscouting') {
			const filter = `org=${org_key},year=${year},type=${form_type}`;
			const syncstatus = await db.syncstatus
				.where({
					table: 'orgschema+schema',
					filter
				})
				.first();
			// Fetch list of match scouting form elements for the associated year
			// JL TODO: since schemas now have a timestamp, implement something similar to TBA's last-modified header
			let apiURL = `/api/orgs/${org_key}/${year}/layout/`;
			if (form_type === 'matchscouting') apiURL += 'match';
			else apiURL += 'pit';
			const { orgschema, schema } = await fetchJSON<{ orgschema: str<OrgSchema>, schema: str<Schema> }>(apiURL);
			logger.debug(`Retrieved ${schema.layout.length} match items`);
			const { layout } = schema;
			const checksum = await SchemaOperations.getChecksum(layout);

			logger.trace('orgschema', orgschema, 'schema', schema, org_key, form_type, year);

			assert(orgschema.org_key === org_key && orgschema.form_type === form_type && orgschema.year === year, 'OrgSchema returned from API does not match request!');
			assert(schema.year === year && schema.form_type === form_type, 'Schema returned from API does not match what was requested!');

			await db.transaction('rw', db.orgschemas, db.schemas, db.syncstatus, async () => {
				logger.trace('Placing orgschema into db...');
				await db.orgschemas.put(orgschema);
				logger.trace('Placing schema into db...');
				await db.schemas.put(schema);
				logger.trace(`Saving sync status for ${form_type}...`);
				await db.syncstatus.put({
					table: 'orgschema+schema',
					filter,
					time: new Date(),
					data: {
						checksum,
						source: 'download',
					}
				});
			});

			// Default to true if syncstatus was not found
			let changed = true;
			if (typeof syncstatus?.data?.checksum === 'string') {
				logger.debug(`Existing checksum: ${syncstatus.data.checksum}`);
				changed = checksum.substring(0, 3) !== syncstatus.data.checksum.substring(0, 3);
			}
			return changed;
		}

		if (doMatch) {
			matchChanged = await doDownload('matchscouting');
		}
		if (doPit) {
			pitChanged = await doDownload('pitscouting');
		}

		logger.trace('Done');
		// Return true if EITHER the pit checksum or match checksum changed
		return pitChanged || matchChanged;
	}

	@setFuncName('SchemaOperations.getChecksum')
	static async getChecksum(items: Schema['layout']) {
		logger.debug('Items to hash:', items);
		const checksum = await base32Hash(JSON.stringify(items));
		logger.debug(`Checksum: ${checksum}`);
		return checksum;
	}

	static async getSchemaForOrgAndEvent(org_key: OrgKey, event_key: EventKey, form_type: Schema['form_type']): Promise<SchemaLocal> {
		const event = await db.events.where({ key: event_key }).first();
		assert(event);
		const year = event.year;

		const orgschema = await db.orgschemas.where({
			org_key,
			year,
			form_type
		}).first();
		assert(orgschema, `${form_type} schema not found for ${org_key} and ${year}! A Team Admin needs to define a schema via the 'Manage' page. Check the "Forms Archive" on the wiki for sample JSON to get started!`);

		const schema = await db.schemas.where({
			_id: orgschema.schema_id
		}).first();
		assert(schema);
		assert(schema.form_type === form_type, `form_type does not match in DB! Expected ${form_type} but found ${schema.form_type}`);
		assert(schema.year === year, `Schema year ${schema.year} and event year ${year} do not match!`);
		return schema;
	}
}

/** @deprecated */
export class FormLayoutOperations extends TableOperations {
	@setFuncName('FormLayoutOperations.download')
	/** @deprecated */
	static async download(type: 'match' | 'pit' | 'both' = 'both') {
		const { event_key, org_key } = getKeys();

		const doPit = type === 'pit' || type === 'both';
		const doMatch = type === 'match' || type === 'both';
		logger.info(`ENTER, downloading ${type}`);

		// grab year from event key
		const year = Number(event_key.substring(0, 4));
		assert(!isNaN(year), `Failed to pull year from event_key: ${event_key}, got a NaN!`);

		let matchChanged = false,
			pitChanged = false;

		if (doMatch) {
			const filter = `org=${org_key},year=${year},type=matchscouting`;
			const syncstatus = await db.syncstatus
				.where({
					table: 'layout',
					filter
				})
				.first();
			// Fetch list of match scouting form elements for the associated year
			const matchFormData = await fetchJSON<str<Layout>[]>(
				`/api/orgs/${org_key}/${event_key?.substring(0, 4)}/layout/match`
			);
			logger.debug(`Retrieved ${matchFormData.length} match items`);
			const matchChecksum = await FormLayoutOperations.getChecksum(matchFormData);
			await db.transaction('rw', db.layout, db.syncstatus, async () => {
				// Remove existing layout for this org+year, because maybe some elements got deleted
				let matchDeleteCount = await db.layout.where({ org_key, year, form_type: 'matchscouting' }).delete();
				logger.debug(`Deleted ${matchDeleteCount} match items`);
				logger.trace('Putting match scouting into db...');
				await db.layout.bulkPut(matchFormData);
				logger.trace('Saving sync status for match scouting...');
				await db.syncstatus.put({
					table: 'layout',
					filter,
					time: new Date(),
					data: {
						checksum: matchChecksum,
						source: 'download'
					}
				});
			});

			// Default to true if syncstatus was not found
			matchChanged = true;
			if (typeof syncstatus?.data?.checksum === 'string') {
				logger.debug(`Existing checksum: ${syncstatus.data.checksum}`);
				matchChanged = matchChecksum.substring(0, 3) !== syncstatus.data.checksum.substring(0, 3);
			}
		}

		if (doPit) {
			const filter = `org=${org_key},year=${year},type=pitscouting`;
			const syncstatus = await db.syncstatus
				.where({
					table: 'layout',
					filter
				})
				.first();
			// Fetch list of match scouting form elements for the associated year
			const pitFormData = await fetchJSON<str<Layout>[]>(
				`/api/orgs/${org_key}/${event_key?.substring(0, 4)}/layout/pit`
			);
			logger.debug(`Retrieved ${pitFormData.length} pit items`);

			const pitChecksum = await FormLayoutOperations.getChecksum(pitFormData);

			logger.trace('Begin transaction');
			await db.transaction('rw', db.layout, db.syncstatus, async () => {
				// Remove existing layout for this org+year, because maybe some elements got deleted
				let pitDeleteCount = await db.layout.where({ org_key, year, form_type: 'pitscouting' }).delete();
				logger.debug(`Deleted ${pitDeleteCount} pit items items`);
				logger.trace('Putting pit scouting into db...');
				await db.layout.bulkPut(pitFormData);
				logger.trace('Saving sync status...');
				await db.syncstatus.put({
					table: 'layout',
					filter,
					time: new Date(),
					data: {
						checksum: pitChecksum,
						source: 'download'
					}
				});
			});

			// Default to true if syncstatus was not found
			pitChanged = true;
			if (typeof syncstatus?.data?.checksum === 'string') {
				logger.debug(`Existing checksum: ${syncstatus.data.checksum}`);
				pitChanged = pitChecksum.substring(0, 3) !== syncstatus.data.checksum.substring(0, 3);
			}
		}

		logger.trace('Done');
		// Return true if EITHER the pit checksum or match checksum changed
		return pitChanged || matchChanged;
	}

	@setFuncName('FormLayoutOperations.getChecksum')
	/** @deprecated */
	static async getChecksum(items: str<Layout>[]) {
		logger.debug('Items to hash:', items);
		const checksum = await base32Hash(JSON.stringify(items));
		logger.debug(`Checksum: ${checksum}`);
		return checksum;
	}
}

export class LightOrgOperations extends TableOperations {
	@setFuncName('LightOrgOperations.download')
	static async download() {
		const orgs = await fetchJSON<LightOrg[]>('/api/orgs');
		logger.debug(`Fetched ${orgs.length} orgs`);

		await db.transaction('rw', db.lightorgs, db.syncstatus, async () => {
			await db.lightorgs.clear();
			logger.info('Cleared orgs db');

			await db.lightorgs.bulkPut(orgs);
			await db.syncstatus.put({
				table: 'lightorgs',
				filter: '',
				time: new Date()
			});
			logger.debug('Successfully saved orgs and saved syncstatus to database');
		});
	}
	@setFuncName('LightOrgOperations.needsSync')
	static async needsSync(timespan = DEFAULT_SYNC_AGE_THRESHOLD) {
		let orgSyncStatus = await db.syncstatus
			.where({
				table: 'lightorgs',
				filter: ''
			})
			.first();
		logger.debug('Org sync status:', orgSyncStatus);

		if (!orgSyncStatus || orgSyncStatus.time.valueOf() < Date.now() - timespan) {
			logger.trace('Returning true');
			return true;
		}
		logger.trace('Returning false');
		return false;
	}
}

export class LightUserOperations extends TableOperations {
	@setFuncName('LightUserOperations.needsSync')
	static async needsSync(org_key: string, timespan = DEFAULT_SYNC_AGE_THRESHOLD) {
		let userSyncStatus = await db.syncstatus
			.where({
				table: 'lightusers',
				filter: `org=${org_key}`
			})
			.first();
		logger.debug('User sync status:', userSyncStatus);

		if (!userSyncStatus || userSyncStatus.time.valueOf() < Date.now() - timespan) {
			logger.trace('Returning true');
			return true;
		}
		logger.trace('Returning false');
		return false;
	}

	@setFuncName('LightUserOperations.download')
	static async download(org_key: string) {
		if (!org_key) throw new Error('No org selected');
		const users = await fetchJSON<LightUser[]>(`/api/orgs/${org_key}/users`);
		logger.debug(`Fetched ${users.length} users`);

		await db.transaction('rw', db.lightusers, db.syncstatus, async () => {
			// Delete existing users that match this org key
			let deletedUsers = await db.lightusers
				.where({
					org_key
				})
				.delete();
			logger.info(`Deleted ${deletedUsers} users from database`);

			await db.lightusers.bulkPut(users);
			await db.syncstatus.put({
				table: 'lightusers',
				filter: `org=${org_key}`,
				time: new Date()
			});
		});
	}
}

export class ImageOperations extends TableOperations {
	// todo: needsSync
	
	@setFuncName('ImageOperations.download')
	static async download() {
		logger.debug('begin');
		const { org_key, event_key } = getKeys();
		const event = await db.events.where({ key: event_key }).first();
		assert(event, 'event not found!');
		const { year } = event;

		const uploadsWithLinks = await fetchJSON<(UploadLocal & {
			links: ImageLinks
		})[]>(`/api/orgs/${org_key}/${year}/images`);
		logger.debug(`Fetched ${uploadsWithLinks.length} uploads`);
		
		const uploadsWithoutLinks: UploadLocal[] = [];
		const s3KeyToLinks: Dict<ImageLinks> = {};
		uploadsWithLinks.forEach(uploadWithLinks => {
			// save image links for downloading later
			s3KeyToLinks[uploadWithLinks.s3_key] = uploadWithLinks.links;
			// Remove the 'links' key from upload object
			let upload = {...uploadWithLinks, links: undefined};
			delete upload.links;
			uploadsWithoutLinks.push(upload);
		})
		
		logger.info('Saving uploads in db');
		// delete and re insert uploads db
		await db.transaction('rw', db.uploads, db.syncstatus, async () => {
			await db.uploads.where({org_key, year}).delete();
			await db.uploads.bulkAdd(uploadsWithoutLinks);
			await db.syncstatus.put({
				table: 'uploads',
				filter: `org=${org_key},year=${year}`,
				time: new Date(),
			});
		});
		
		// Find the s3 keys that are already downloaded, so we can skip those
		let s3KeysList = Object.keys(s3KeyToLinks);
		let s3KeysInDbList = await db.images.where('s3_key').anyOf(s3KeysList).keys();
		logger.info(`${s3KeysList.length} sets of images to download; ${s3KeysInDbList.length} of which are already downloaded`);
		// Now, download any of them that aren't in the db
		let s3KeysToDownload = s3KeysList.filter(item => !s3KeysInDbList.includes(item));
		
		for (let s3_key of s3KeysToDownload) {
			let imageLinks = s3KeyToLinks[s3_key];
			assert(imageLinks, 's3LinksToKey[key] undefined');
			
			logger.debug(`Requesting images for ${s3_key}`);
			// Grab images in parallel
			let [smResponse, mdResponse, lgResponse] = await Promise.all([
				fetch(imageLinks.sm),
				fetch(imageLinks.md),
				fetch(imageLinks.lg),
			]);
			
			// Get them as blobs
			let [sm, md, lg] = await Promise.all([
				smResponse.blob(),
				mdResponse.blob(),
				lgResponse.blob(),
			]);
			
			logger.debug(`Inserting ${s3_key} into db`);
			// Insert into db
			await db.images.put({
				s3_key,
				sm,
				md,
				lg
			});
		}

		console.log('uploads', uploadsWithLinks);
	}
}

// Create a decorator function that takes funcName as a string, runs logger.setFuncName(funcName) first, then runs the provided function with all its args, then runs logger.unsetFuncName() before exiting
function setFuncName(funcName: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		descriptor.value = async function (...args: any[]) {
			logger.setFuncName(funcName);
			const result = await originalMethod.apply(this, args);
			logger.unsetFuncName();
			return result;
		};
	};
}
