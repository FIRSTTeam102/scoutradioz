<script lang="ts">
	import Paper from '@smui/paper';
	import QrCodeScanner from '$lib/QrCodeScanner.svelte';
	import {
		decode,
		decodeMatchScouting,
		decodeOneMatchScoutingResult,
		decodeOnePitScoutingResult
	} from '$lib/compression';
	import type { LightMatch, LightUser, MatchScoutingLocal, PitScoutingLocal, str, TeamLocal } from '$lib/localDB';
	import type { Event } from 'scoutradioz-types';
	import db from '$lib/localDB';
	import type { Org } from 'scoutradioz-types';
	import { getLogger } from '$lib/logger';
	import { getContext } from 'svelte';
	import type { SnackbarContext } from '$lib/types';
	import { MatchScoutingOperations, PitScoutingOperations } from '$lib/DBOperations';

	let qrcodeEnabled = true;

	const logger = getLogger('sync/Scanner');
	const snackbar = getContext('snackbar') as SnackbarContext;

	async function onQrCodeData(e: CustomEvent<{ text: string; ms: number }>) {
		try {
			console.log('ONQRCODEDATA EVENT FIRED');
			qrcodeEnabled = false; // Disable scanning while we process the data

			// snackbar.open(e.detail.text);
			let base64 = e.detail.text as string;
			// console.log('got le data', base64);
			let decodedData = await decode(base64);
			console.log('DECODED FROM QR CODE!!');

			let snackbarClosedPromise = snackbar.open(
				`Found: ${decodedData.label} (${e.detail.ms} ms)`,
				undefined,
				'Scan more'
			);
			snackbarClosedPromise.then(() => {
				qrcodeEnabled = true;
			});

			switch (decodedData.type) {
				case 'sched': {
					let matchscouting = decodedData.data.matchscouting as MatchScoutingLocal[];
					let checksum = decodedData.data.checksum as string;
					await MatchScoutingOperations.insertFromQR(matchscouting, checksum);
					// Try and rebuild all the LightMatches from these matchscouting data
					let matchMap: Dict<LightMatch> = {};
					for (let asg of matchscouting) {
						const { match_team_key } = asg;
						const event_key = match_team_key.split('_')[0]; // e.g. 2019paca
						const match_identifier = match_team_key.split('_')[1]; // e.g. qm11
						const team_key = match_team_key.split('_')[2]; // e.g. frc102
						const match_key = `${event_key}_${match_identifier}`; // e.g. 2019paca_qm11
						const comp_level = match_identifier.substring(0, 2); // e.g. qm
						const set_number = 1; // TODO: pull this from the match_team_key in case scouting qf/sf/f
						const match_number = parseInt(match_identifier.substring(2));
						const time = asg.time; // TODO: check if this matches the match's time
						if (isNaN(match_number)) {
							throw new Error(
								`Failed to decode match info for match_team_key ${match_team_key}: match_number is NaN!!!`
							);
						}
						if (!matchMap[match_key]) {
							matchMap[match_key] = {
								key: match_key,
								event_key,
								comp_level,
								set_number,
								match_number,
								alliances: {
									red: {
										team_keys: [],
										score: -1 // TODO: include score in the qr code
									},
									blue: {
										team_keys: [],
										score: -1
									}
								},
								time
							};
						}
						// Add this team key to the match's alliance
						matchMap[match_key].alliances[asg.alliance].team_keys.push(team_key);
					}
					const rebuiltMatches = Object.values(matchMap);
					if (
						!rebuiltMatches.every(
							(match) =>
								match.alliances.blue.team_keys.length === 3 &&
								match.alliances.red.team_keys.length === 3
						)
					) {
						logger.error(
							"Not all matches' team keys were found! Match list that was recovered:",
							rebuiltMatches
						);
						throw new Error("Not all matches' team keys were found! Check the logs for details.");
					}
					await db.lightmatches.bulkPut(rebuiltMatches);
					break;
				}
				case 'pit': {
					let pitscouting = decodedData.data.pitscouting as PitScoutingLocal[];
					let checksum = decodedData.data.checksum as string;
					logger.debug('pitscouting', pitscouting, 'checksum', checksum);
					await PitScoutingOperations.insertFromQR(pitscouting, checksum);
					break;
				}
				case 'meta': {
					let org = decodedData.data.org as str<Org>;
					let users = decodedData.data.users as LightUser[];
					let teams = decodedData.data.teams as TeamLocal[];
					let event = decodedData.data.event as str<Event>;
					logger.debug('org', org, 'users', users, 'teams', teams, 'event', event);
					await db.transaction('rw', db.orgs, db.lightusers, db.teams, db.events, async () => {
						let existingOrg = await db.orgs.where({org_key: org.org_key}).first();
						// If the org already exists in Dexie, then the scouter will already have the org config, so don't overwrite it (only update current event)
						if (existingOrg) {
							await db.orgs.update(org.org_key, {
								event_key: org.event_key,
								// Might as well update the fields that were included in the qr code just in case
								nickname: org.nickname, 
								team_number: org.team_number,
								team_numbers: org.team_numbers,
								team_key: org.team_key,
								team_keys: org.team_keys,
							});
						}
						else await db.orgs.put(org);
						await db.lightusers.bulkPut(users);
						await db.teams.bulkPut(teams);
						await db.events.put(event);
					})
					break;
				}
				case '1matchdata': {
					let { match_team_key, data, actual_scorer, completed, synced } = decodedData.data as Awaited<
						ReturnType<typeof decodeOneMatchScoutingResult>
					>['data'];
					logger.debug('1matchdata', match_team_key, data, actual_scorer);
					if ((await db.matchscouting.where({ match_team_key }).count()) === 0) {
						throw new Error(
							`Match scouting assignment not found for match_team_key ${match_team_key}!`
						);
					}
					await db.matchscouting.update(match_team_key, {
						data,
						actual_scorer,
						synced, // If the scouter informed us that it's already synced, then we include that here
						completed,
					});
					break;
				}
				case '1pitdata': {
					let { actual_scouter, data, org_key, event_key, team_key, completed, synced } = decodedData.data as Awaited<
						ReturnType<typeof decodeOnePitScoutingResult>
					>['data'];
					logger.debug('Retrieved the following:', actual_scouter, data, org_key, event_key, team_key);
					let existingAssignment = await db.pitscouting.where({org_key, event_key, team_key}).first();
					if (!existingAssignment) {
						throw new Error(
							`Pit scouting assignment not found for org_key ${org_key}, event_key ${event_key}, team_key ${team_key}!`
						);
					}
					await db.pitscouting.update(existingAssignment, {
						data,
						actual_scouter,
						synced, // If the scouter informed us that it's already synced, then we include that here
						completed,
					});
					break;
				}
			}
		} catch (err) {
			snackbar.close();
			console.error(err);
			let message = err instanceof Error ? err.message : err;
			snackbar.error(`Error: ${message}`);
			qrcodeEnabled = true; // Attempt to resume scanning
		}
	}
</script>

<QrCodeScanner on:data={onQrCodeData} enabled={qrcodeEnabled} />
