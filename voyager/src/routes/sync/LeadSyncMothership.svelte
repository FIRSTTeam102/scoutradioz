<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';
	import db, {
		type TeamLocal,
		type LightMatch,
		type MatchScoutingLocal,
		type str,
		type WithStringDbId,
		type PitScoutingLocal,
		type LightUser,
	} from '$lib/localDB';
	import { MatchScoutingOperations, FormLayoutOperations, PitScoutingOperations } from '$lib/DBOperations';
	import { liveQuery } from 'dexie';
	import { getLogger } from '$lib/logger';

	import { addRefreshButtonFunctionality, fetchJSON, getPageLayoutContexts } from '$lib/utils';
	import assert from '$lib/assert';
	import type { MatchScouting, PitScouting, User, Event, Org, Layout } from 'scoutradioz-types';
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { RefreshButtonAnimationContext, RefreshContext, SnackbarContext } from '$lib/types';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';

	const logger = getLogger('sync/LeadSyncMothership');

	const { snackbar, refreshButton, refreshButtonAnimation } = getPageLayoutContexts();
	addRefreshButtonFunctionality(() =>
		snackbar.open(
			"Sorry, the button on this page right now is only to show the animation when something is loading. Clicking it won't do anything rn."
		)
	);

	let errorMessage: string;

	$: org_key = $page.data.org_key as string;
	$: event_key = $page.data.event_key as string;

	// Retrieve the # of matchscouting and pitscouting layout elements in the DB
	$: matchscoutingFormElements = liveQuery(async () => {
		assert(event_key);

		return await db.layout
			.where({
				org_key: org_key,
				year: Number(event_key?.substring(0, 4)),
				form_type: 'matchscouting'
			})
			.count();
	});

	$: pitscoutingFormElements = liveQuery(async () => {
		assert(event_key);

		return await db.layout
			.where({
				org_key: org_key,
				year: Number(event_key?.substring(0, 4)),
				form_type: 'pitscouting'
			})
			.count();
	});

	// Retrieve the # of match scouting entries with and without data
	$: matchScoutingNoData = liveQuery(async () => {
		assert(event_key);

		return await db.matchscouting
			.where({
				event_key: event_key,
				org_key: org_key
			})
			.filter((item) => !item.data)
			.count();
	});

	$: matchScoutingWithData = liveQuery(async () => {
		assert(event_key);

		return await db.matchscouting
			.where({
				event_key: event_key,
				org_key: org_key
			})
			.filter((item) => !!item.data)
			.count();
	});

	$: qualifyingMatches = liveQuery(async () => {
		return await db.lightmatches
			.where({
				event_key: event_key,
				comp_level: 'qm'
			})
			.count();
	});

	$: teams = liveQuery(async () => db.teams.count());
	$: orgs = liveQuery(async () => db.orgs.count());

	// Retrieve the # of pit scouting entries with and without data
	$: pitScoutingNoData = liveQuery(async () => {
		return await db.pitscouting
			.where({
				event_key: event_key,
				org_key: org_key
			})
			.filter((item) => !item.data)
			.count();
	});

	$: pitScoutingWithData = liveQuery(async () => {
		assert(event_key);

		return await db.pitscouting
			.where({
				event_key: event_key,
				org_key: org_key
			})
			.filter((item) => !!item.data)
			.count();
	});

	$: users = liveQuery(async () => {
		return await db.lightusers.where({ org_key: org_key }).count();
	});

	async function downloadFormData() {
		try {
			assert(event_key, 'event_key not defined');

			// Fetch list of match scouting form elements for the associated year
			const matchFormData = await fetchJSON<WithStringDbId<Layout>[]>(
				`/api/orgs/${org_key}/${event_key?.substring(0, 4)}/layout/match`
			);
			await db.layout.bulkPut(matchFormData);

			// Fetch list of match scouting form elements for the associated year
			const pitFormData = await fetchJSON<WithStringDbId<Layout>[]>(
				`/api/orgs/${org_key}/${event_key?.substring(0, 4)}/layout/pit`
			);
			await db.layout.bulkPut(pitFormData);
		} catch (err) {
			handleError(err);
		}
	}

	async function downloadMatches() {
		try {
			const matches = await fetchJSON<LightMatch[]>(`/api/${event_key}/matches`);
			let numDeleted = await db.lightmatches
				.where({
					event_key: event_key
				})
				.delete();
			logger.info(`${numDeleted} matches deleted from db`);

			await db.lightmatches.bulkAdd(matches);

			const event = await fetchJSON<str<Event>>(`/api/${event_key}`);
			await db.events
				.where({
					key: event_key
				})
				.delete();
			await db.events.add(event);

			const teams = await fetchJSON<TeamLocal[]>(`/api/${event_key}/teams`);
			// Clear teams
			numDeleted = await db.teams.where('key').anyOf(event.team_keys).delete();
			logger.info(`${numDeleted} teams deleted from db`);
			await db.teams.bulkAdd(teams);
		} catch (err) {
			handleError(err);
		}
	}

	let dangerouslyUploadAll = false;

	// TODO: only sync ones with data, and/or only sync ones marked as not synced?
	async function uploadPitScouting() {
		try {
			assert(org_key && event_key, 'org_key and event_key not defined');

			const pitCol = db.pitscouting.where({ org_key: org_key, event_key: event_key });
			let pitscouting: PitScoutingLocal[];
			if (dangerouslyUploadAll) {
				if (
					!confirm(
						"Really upload all data, not synced data? (If a scouter uploaded something on their own device and it didn't get sent to yours via QR, it will be overwritten!!"
					)
				)
					return;
				pitscouting = await pitCol.toArray();
			} else {
				pitscouting = await pitCol.and((pit) => pit.synced === false).toArray();
			}

			if (pitscouting.length === 0)
				throw new Error('No pitscouting found that was not already synced');

			let bulkWriteResult = await fetchJSON(`/api/orgs/${org_key}/${event_key}/submit/pit`, {
				body: JSON.stringify(pitscouting),
				method: 'POST'
			});
			logger.info('bulkWriteResult: ', bulkWriteResult);
			if (bulkWriteResult.ok) {
				// Mark synced on all of the pit scouting entries
				await db.pitscouting
					.where({
						org_key: org_key,
						event_key: event_key
					})
					.modify((pit) => (pit.synced = true));
				snackbar.open(`Uploaded data from ${pitscouting.length} assignments successfully.`);
			} else {
				throw new Error(
					`Response from the server was not marked as ok! ${JSON.stringify(bulkWriteResult)}`
				);
			}
		} catch (err) {
			handleError(err);
		}
	}

	async function uploadMatchScouting() {
		try {
			assert(org_key && event_key, 'org_key and event_key not defined');

			const matchCol = db.matchscouting.where({
				org_key: org_key,
				event_key: event_key
			});

			let matchscouting: MatchScoutingLocal[];
			if (dangerouslyUploadAll) {
				if (
					!confirm(
						"Really upload all data, not synced data? (If a scouter uploaded something on their own device and it didn't get sent to yours via QR, it will be overwritten!!"
					)
				)
					return;
				matchscouting = await matchCol.toArray();
			} else {
				matchscouting = await matchCol.and((match) => match.synced === false).toArray();
			}

			if (matchscouting.length === 0)
				throw new Error('No matchscouting found that was not already synced');

			let bulkWriteResult = await fetchJSON(`/api/orgs/${org_key}/${event_key}/submit/match`, {
				body: JSON.stringify(matchscouting),
				method: 'POST'
			});
			logger.info('bulkWriteResult: ', bulkWriteResult);
			if (bulkWriteResult.ok) {
				// Mark synced on all of the match scouting entries
				await db.matchscouting
					.where({
						org_key: org_key,
						event_key: event_key
					})
					.modify((match) => (match.synced = true));
				snackbar.open(`Uploaded data from ${matchscouting.length} assignments successfully.`);
			} else {
				throw new Error(
					`Response from the server was not marked as ok! ${JSON.stringify(bulkWriteResult)}`
				);
			}
		} catch (err) {
			handleError(err);
		}
	}

	async function downloadUsers() {
		try {
			const users = await fetchJSON<LightUser[]>(`/api/orgs/${org_key}/users`);

			// let numDeleted = await db.lightusers.where({
			// 	org_key: org_key
			// }).delete();
			// console.log(`${numDeleted} users deleted from db`);

			// await db.lightusers.bulkAdd(users);
			let result = await db.lightusers.bulkPut(users);
			logger.trace(result);

			const org = await fetchJSON<str<Org>>(`/api/orgs/${org_key}`);
			// numDeleted = await db.orgs.where({org_key: org_key}).delete();
			// console.log(`${numDeleted} orgs deleted from db`);
			// await db.orgs.add(org);
			await db.orgs.put(org);
			// since event_key can be updated after org is downloaded
			await invalidateAll();
		} catch (err) {
			handleError(err);
		}
	}

	function handleError(err: unknown) {
		if (err instanceof Error) {
			errorMessage = err.message;
		} else {
			errorMessage = 'An unknown error occurred.';
		}
		snackbar.error(errorMessage);
	}

	async function wrap(func: () => void|Promise<void>) {
		try {
			console.log('autoplay begin');
			await refreshButtonAnimation.autoplay(func);
		} catch (err) {
			console.log('caught!')
			handleError(err);
		}
	}
</script>

<section class="pad">
	<h2>Mothership sync: {event_key}</h2>

	<div class="card-list">
		<Card>
			<Content>
				<h5>Org info</h5>
				<p>
					{$users} users
				</p>
				<p>
					{$orgs} orgs in db
				</p>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button variant="outlined" on:click={downloadUsers}>
						<Icon class="material-icons">person</Icon>
						<BLabel>Download users / org info</BLabel>
					</Button>
				</Group>
			</CActions>
		</Card>
		<Card>
			<Content>
				<h5>Match scouting</h5>
				<p>
					{$matchScoutingNoData} entries without data, {$matchScoutingWithData} entries with data
				</p>
				<p>
					{$qualifyingMatches} qualifying matches, {$teams} total teams in database
				</p>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button variant="outlined" on:click={() => wrap(MatchScoutingOperations.download)}>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download assignments</BLabel>
					</Button>
					<Button
						variant="outlined"
						on:click={() => refreshButtonAnimation.autoplay(downloadMatches)}
					>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download matches</BLabel>
					</Button>
					<Button
						variant="outlined"
						on:click={() => {
							refreshButtonAnimation.autoplay(uploadMatchScouting);
						}}
					>
						<Icon class="material-icons">upload</Icon>
						<BLabel>Upload data</BLabel>
					</Button>
				</Group>
			</CActions>
		</Card>
		<Card>
			<Content>
				<h5>Pit scouting</h5>
				<p>
					{$pitScoutingNoData} entries without data, {$pitScoutingWithData} entries with data
				</p>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button
						variant="outlined"
						on:click={() => wrap(PitScoutingOperations.download)}
					>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download assignments</BLabel>
					</Button>
					<Button
						variant="outlined"
						on:click={() => {
							refreshButtonAnimation.autoplay(uploadPitScouting);
						}}
					>
						<Icon class="material-icons">upload</Icon>
						<BLabel>Upload data</BLabel>
					</Button>
				</Group>
			</CActions>
		</Card>
		<Card>
			<Content>
				<h5>Form data</h5>
				<p>
					{$matchscoutingFormElements} match form entries, {$pitscoutingFormElements} pit form entries
				</p>
			</Content>
			<CActions>
				<Button variant="outlined" on:click={() => wrap(FormLayoutOperations.download)}>
					<Icon class="material-icons">download</Icon>
					<BLabel>Download form data</BLabel>
				</Button>
			</CActions>
		</Card>
	</div>

	<label for="dangerouslyUpload">
		<input id="dangerouslyUpload" type="checkbox" bind:checked={dangerouslyUploadAll} />
		Dangerously upload ALL data, instead of just not-synced data?
	</label>
</section>

<style lang="scss">
	.card-list {
		display: grid;
		grid-template-columns: 1;
		gap: 0.5rem;
	}
</style>
