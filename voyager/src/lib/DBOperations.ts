import { get as getStore } from 'svelte/store';
import { page } from '$app/stores';
import { base32Hash, fetchJSON } from './utils';
import { getLogger } from './logger';
import type { Layout, Event } from 'scoutradioz-types';
import type {
	MatchScoutingLocal,
	TeamLocal,
	WithStringDbId,
	LightMatch,
	str,
	PitScoutingLocal,
	LightOrg,
	LightUser
} from './localDB';
import db from './localDB';
import assert from './assert';

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

		// Fetch list of match scouting assignments for this event
		const matchScouting = await fetchJSON<MatchScoutingLocal[]>(`/api/orgs/${org_key}/${event_key}/assignments/match`);
		// Merge with existing data
		const localMatchScouting = await db.matchscouting.where({ org_key, event_key }).toArray();
		const mergedMatchScouting = await MatchScoutingOperations.merge(matchScouting, localMatchScouting);

		const checksum = await MatchScoutingOperations.getChecksum(mergedMatchScouting);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.matchscouting, db.syncstatus, async () => {
			await db.matchscouting.bulkPut(mergedMatchScouting);
			await db.syncstatus.put({
				table: 'matchscouting',
				filter: `org=${org_key},event=${event_key}`,
				time: new Date(),
				data: {
					checksum,
					source: 'download'
				}
			});
		});
		logger.trace('Done');
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
				if (index && newItems[index]) {
					newItems[index].data = localMatch.data;
					newItems[index].synced = localMatch.synced;
					newItems[index].completed = localMatch.completed;
					newItems[index].history = localMatch.history;
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

		// Fetch list of pit scouting assignments for this event
		const pitScouting = await fetchJSON<PitScoutingLocal[]>(`/api/orgs/${org_key}/${event_key}/assignments/pit`);

		const localPitScouting = await db.pitscouting.where({ org_key, event_key }).toArray();
		const mergedPitScouting = await PitScoutingOperations.merge(pitScouting, localPitScouting);
		const checksum = await PitScoutingOperations.getChecksum(mergedPitScouting);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.pitscouting, db.syncstatus, async () => {
			await db.pitscouting.bulkPut(pitScouting);
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
		logger.trace('Done');
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
				if (index && newItems[index]) {
					newItems[index].data = localPit.data;
					newItems[index].synced = localPit.synced;
					newItems[index].completed = localPit.completed;
					newItems[index].history = localPit.history;
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

export class FormLayoutOperations extends TableOperations {
	@setFuncName('FormLayoutOperations.download')
	static async download() {
		const { event_key, org_key } = getKeys();

		// grab year from event key
		const year = Number(event_key.substring(0, 4));
		assert(!isNaN(year), `Failed to pull year from event_key: ${event_key}, got a NaN!`);

		// Fetch list of match scouting form elements for the associated year
		const matchFormData = await fetchJSON<str<Layout>[]>(
			`/api/orgs/${org_key}/${event_key?.substring(0, 4)}/layout/match`
		);

		// Fetch list of match scouting form elements for the associated year
		const pitFormData = await fetchJSON<str<Layout>[]>(
			`/api/orgs/${org_key}/${event_key?.substring(0, 4)}/layout/pit`
		);
		logger.debug(`Retrieved ${matchFormData.length} match items and ${pitFormData.length} pit items`);
		
		const matchChecksum = await FormLayoutOperations.getChecksum(matchFormData);
		const pitChecksum = await FormLayoutOperations.getChecksum(pitFormData);

		logger.trace('Begin transaction');
		await db.transaction('rw', db.layout, db.syncstatus, async () => {
			// Remove existing layout for this org+year, because maybe some elements got deleted
			let pitDeleteCount = await db.layout.where({ org_key, year, form_type: 'pitscouting' }).delete();
			let matchDeleteCount = await db.layout.where({ org_key, year, form_type: 'matchscouting' }).delete();
			logger.debug(`Deleted ${pitDeleteCount} pit items and ${matchDeleteCount} match items`);
			logger.trace('Putting match & pit scouting into db...');
			await db.layout.bulkPut(pitFormData);
			await db.layout.bulkPut(matchFormData);
			logger.trace('Saving sync status...');
			await db.syncstatus.bulkPut([
				{
					table: 'layout',
					filter: `org=${org_key},year=${year},type=matchscouting`,
					time: new Date(),
					data: {
						checksum: matchChecksum,
						source: 'download',
					}
				},
				{
					table: 'layout',
					filter: `org=${org_key},year=${year},type=pitscouting`,
					time: new Date(),
					data: {
						checksum: pitChecksum,
						source: 'download',
					},
				}
			]);
		});
		logger.trace('Done');
	}

	@setFuncName('FormLayoutOperations.getChecksum')
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
		const orgs = await fetchJSON<LightOrg[]>(`/api/orgs`);
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
