<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';
	import db, {
		type TeamLocal,
		type LightMatch,
		type MatchScoutingLocal,
		type str,
		type WithStringDbId
	} from '$lib/localDB';
	import { liveQuery } from 'dexie';
	import { getLogger } from '$lib/logger';

	import { event_key, org_key, getStore } from '$lib/stores';
	import { fetchJSON } from '$lib/utils';
	import assert from '$lib/assert';
	import type { MatchScouting, PitScouting, User, Event, Org } from 'scoutradioz-types';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';

	const logger = getLogger('LeadSyncMothership');

	let snackbar: SimpleSnackbar;
	let errorMessage: string;

	// Retrieve the # of match scouting entries with and without data
	$: matchScoutingNoData = liveQuery(async () => {
		assert($event_key);

		return await db.matchscouting
			.where({
				event_key: $event_key,
				org_key: $org_key
			})
			.filter((item) => !item.data)
			.count();
	});

	$: matchScoutingWithData = liveQuery(async () => {
		assert($event_key);

		return await db.matchscouting
			.where({
				event_key: $event_key,
				org_key: $org_key
			})
			.filter((item) => !!item.data)
			.count();
	});

	$: qualifyingMatches = liveQuery(async () => {
		return await db.lightmatches
			.where({
				event_key: $event_key,
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
				event_key: $event_key,
				org_key: $org_key
			})
			.filter((item) => !item.data)
			.count();
	});

	$: pitScoutingWithData = liveQuery(async () => {
		assert($event_key);

		return await db.pitscouting
			.where({
				event_key: $event_key,
				org_key: $org_key
			})
			.filter((item) => !!item.data)
			.count();
	});

	$: users = liveQuery(async () => {
		return await db.lightusers.where({ org_key: $org_key }).count();
	});

	async function downloadMatchScouting() {
		try {
			// Fetch list of match scouting assignments for this event
			const matchScouting = await fetchJSON<MatchScoutingLocal[]>(
				`/api/orgs/${$org_key}/${$event_key}/assignments/match`
			);
			assert($event_key, 'event_key not defined');

			// Delete existing match scouting entries (We'll have to code something less dangerous at some point, cuz this'll override non-synced data)
			// let numDeleted = await db.matchscouting
			// 	.where({
			// 		event_key: $event_key,
			// 		org_key: $org_key
			// 	})
			// 	.delete();
			// console.log(`${numDeleted} deleted from db`);

			// // Insert the assignments into Dexie
			// await db.matchscouting.bulkAdd(matchScouting);
			await db.matchscouting.bulkPut(matchScouting);
		} catch (err) {
			handleError(err);
		}
	}

	async function downloadMatches() {
		try {
			const matches = await fetchJSON<LightMatch[]>(`/api/${$event_key}/matches`);
			let numDeleted = await db.lightmatches
				.where({
					event_key: $event_key
				})
				.delete();
			logger.info(`${numDeleted} matches deleted from db`);

			await db.lightmatches.bulkAdd(matches);

			// const event = await fetchJSON<Event>{
			// 	`/api/${$event_key}`
			// };
			const event = await fetchJSON<str<Event>>(`/api/${$event_key}`);
			await db.events
				.where({
					key: $event_key
				})
				.delete();
			await db.events.add(event);

			const teams = await fetchJSON<TeamLocal[]>(`/api/${$event_key}/teams`);
			// Clear teams
			numDeleted = await db.teams.where('key').anyOf(event.team_keys).delete();
			logger.info(`${numDeleted} teams deleted from db`);
			await db.teams.bulkAdd(teams);
		} catch (err) {
			handleError(err);
		}
	}

	async function downloadPitScouting() {
		try {
			// Fetch list of match scouting assignments for this event
			const pitScouting = await fetchJSON<WithStringDbId<PitScouting>[]>(
				`/api/orgs/${$org_key}/${$event_key}/assignments/pit`
			);

			// Delete existing match scouting entries (We'll have to code something less dangerous at some point, cuz this'll override non-synced data)
			let numDeleted = await db.pitscouting
				.where({
					event_key: $event_key,
					org_key: $org_key
				})
				.delete();
			logger.info(`${numDeleted} deleted from db`);

			// Insert the assignments into Dexie
			await db.pitscouting.bulkAdd(pitScouting);
		} catch (err) {
			handleError(err);
		}
	}

	async function downloadUsers() {
		try {
			const users = await fetchJSON<WithStringDbId<User>[]>(`/api/orgs/${$org_key}/users`);

			// let numDeleted = await db.lightusers.where({
			// 	org_key: $org_key
			// }).delete();
			// console.log(`${numDeleted} users deleted from db`);

			// await db.lightusers.bulkAdd(users);
			let result = await db.lightusers.bulkPut(users);
			logger.trace(result);

			const org = await fetchJSON<str<Org>>(`/api/orgs/${$org_key}`);
			// numDeleted = await db.orgs.where({org_key: $org_key}).delete();
			// console.log(`${numDeleted} orgs deleted from db`);
			// await db.orgs.add(org);
			await db.orgs.put(org);
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
		// if (errorSnackbar) errorSnackbar.forceOpen();
	}
</script>

<section class="pad">
	<h2>Mothership sync: {$event_key}</h2>

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
						<BLabel>Download users</BLabel>
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
					<Button variant="outlined" on:click={downloadMatchScouting}>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download assignments</BLabel>
					</Button>
					<Button variant="outlined" on:click={downloadMatches}>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download matches</BLabel>
					</Button>
					<Button variant="outlined" on:click={() => {}}>
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
					<Button variant="outlined" on:click={downloadPitScouting}>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download assignments</BLabel>
					</Button>
					<Button
						variant="outlined"
						on:click={() => {
							handleError(new Error('foo bar'));
						}}
					>
						<Icon class="material-icons">upload</Icon>
						<BLabel>Upload data</BLabel>
					</Button>
				</Group>
			</CActions>
		</Card>
	</div>

	<SimpleSnackbar bind:this={snackbar} />
</section>

<style lang="scss">
	.card-list {
		display: grid;
		grid-template-columns: 1;
		gap: 0.5rem;
	}
</style>
