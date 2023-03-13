<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';
	import db, { type MatchScoutingLocal, type WithStringDbId } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import { event_key, org_key, getStore } from '$lib/stores';
	import { fetchJSON } from '$lib/fetcher';
	import assert from '$lib/assert';
	import type { MatchScouting, PitScouting, User } from 'scoutradioz-types';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';

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
		return await db.lightusers
			.where({org_key: $org_key})
			.count();
	})

	async function downloadMatchScouting() {
		try {
			// Fetch list of match scouting assignments for this event
			const matchScouting = await fetchJSON<MatchScoutingLocal[]>(
				`/api/orgs/${$org_key}/${$event_key}/assignments/match`
			);
			assert($event_key, 'event_key not defined');

			// Delete existing match scouting entries (We'll have to code something less dangerous at some point, cuz this'll override non-synced data)
			let numDeleted = await db.matchscouting
				.where({
					event_key: $event_key,
					org_key: $org_key
				})
				.delete();
			console.log(`${numDeleted} deleted from db`);

			// Insert the assignments into Dexie
			await db.matchscouting.bulkAdd(matchScouting);
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
			let numDeleted = await db.pitscouting.where({
				event_key: $event_key,
				org_key: $org_key,
			}).delete();
			console.log(`${numDeleted} deleted from db`);

			// Insert the assignments into Dexie
			await db.pitscouting.bulkAdd(pitScouting);
		} catch (err) {
			handleError(err);
		}
	}
	
	async function downloadUsers() {
		try {
			const users = await fetchJSON<WithStringDbId<User>[]>(
				`/api/orgs/${$org_key}/users`
			);
			
			let numDeleted = await db.lightusers.where({
				org_key: $org_key
			}).delete();
			console.log(`${numDeleted} deleted from db`);
			
			await db.lightusers.bulkAdd(users);
		}
		catch (err) {
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
				<h1 class="mdc-typography--headline5">Org info</h1>
				<p class="mdc-typography--body1">
					{$users} users
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
				<h1 class="mdc-typography--headline5">Match scouting</h1>
				<p class="mdc-typography--body1">
					{$matchScoutingNoData} entries without data, {$matchScoutingWithData} entries with data
				</p>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button variant="outlined" on:click={downloadMatchScouting}>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download assignments</BLabel>
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
				<h1 class="mdc-typography--headline5">Pit scouting</h1>
				<p class="mdc-typography--body1">
					{$pitScoutingNoData} entries without data, {$pitScoutingWithData} entries with data
				</p>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button variant="outlined" on:click={downloadPitScouting}>
						<Icon class="material-icons">download</Icon>
						<BLabel>Download assignments</BLabel>
					</Button>
					<Button variant="outlined" on:click={() => {handleError(new Error('foo bar'))}}>
						<Icon class="material-icons">upload</Icon>
						<BLabel>Upload data</BLabel>
					</Button>
				</Group>
			</CActions>
		</Card>
	</div>

	<SimpleSnackbar bind:this={snackbar}/>
</section>

<style lang="scss">
	.card-list {
		display: grid;
		grid-template-columns: 1;
		gap: 0.5rem;
	}
</style>
