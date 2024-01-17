<script lang="ts">
	import type { PageData } from './$types';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import BottomNavBar, { type NavBarItem } from '$lib/nav/BottomNavBar.svelte';
	import type BottomAppBar from '@smui-extra/bottom-app-bar';
	import { getLogger } from '$lib/logger';
	import db from '$lib/localDB';
	import { goto } from '$app/navigation';
	import { deviceOnline, event_key, org_key, userId, userName } from '$lib/stores';
	import { fetchJSON } from '$lib/utils';
	import type { BulkWriteResult } from 'mongodb';
	import Card from '@smui/card';

	export let data: PageData;

	const logger = getLogger('scouting/match/form');

	let bottomAppBar: BottomAppBar;

	// Initialize formData if necessary
	let formData: Required<typeof data.matchScoutingEntry.data> = data.matchScoutingEntry.data || {};
	let allDefaultValues: boolean;

	$: scouterRecord = $userId
		? {
				id: $userId,
				name: $userName
		  }
		: undefined;

	// When formData changes (any time a form is edited), update the matchscouting entry in the database
	// 	If all of the forms are at their default values, then set data undefined
	$: {
		logger.trace(`Updating formData in the database - allDefault=${allDefaultValues}`);
		db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
			data: allDefaultValues ? undefined : formData,
			synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
			actual_scorer: scouterRecord
		});
	}

	let bottomBarActions: NavBarItem[] = [
		{
			onClick: () => {
				// TODO: use nice dialog instead of confirm()
				if (
					confirm(
						'Really reset the data from this match? (The changes will only be local; this action will not delete data on the server if it exists)'
					)
				) {
					logger.info(`Discarding form data from match ${data.matchScoutingEntry.match_team_key}`);
					db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
						data: undefined
					});
					goto('/scouting/match');
				}
			},
			label: 'Discard',
			icon: 'delete'
		},
		{
			onClick: async () => {
				if (!$userId || !$userName) {
					throw logger.error('Not logged in! This should have been handled in +page.ts');
				}
				logger.info(
					`Saving actual_scorer for match acouting key ${data.matchScoutingEntry.match_team_key}`
				);
				// Intentional design decision: Write data to the local db when they hit the check/done button even if
				// 	the data are at defaults, because in cases where a robot no-shows, some orgs might not have
				// 	checkboxes like no-show / died during match, so some orgs might accept empty forms
				await db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
					actual_scorer: {
						id: $userId,
						name: $userName
					},
					data: formData,
					synced: false // since the entry is being updated locally, we must force synced=false until it definitely is synced
				});

				if ($deviceOnline) {
					logger.debug('navigator.onLine = true; going to attempt a cloud sync myself');
					let entry = await db.matchscouting
						.where('match_team_key')
						.equals(data.matchScoutingEntry.match_team_key)
						.first();
					let bulkWriteResult = (await fetchJSON(
						`/api/orgs/${$org_key}/${$event_key}/submit/match`,
						{
							body: JSON.stringify([entry]),
							method: 'POST'
						}
					)) as BulkWriteResult;
					logger.info('bulkWriteResult: ', bulkWriteResult);
					// If submitted successfully, mark this local match scouting entry as synced
					if (bulkWriteResult.ok) {
						await db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
							synced: true
						});
					}
				} else logger.info('Device offline; not attempting a cloud sync');
				goto('/scouting/match');
			},
			label: 'Done (Back to list)',
			icon: 'done'
		},
		{
			onClick: () => {
				alert('Not implemented');
			},
			label: 'Next assignment',
			icon: 'arrow_forward'
		}
	];
	console.log('voyagersrc\routesscoutingmatch\form+page.svelte:');
	console.log(JSON.stringify(data.matchScoutingEntry));
</script>

<div class="grid mt-4">
	<Card padded class="place-self-center bg-red-600">
		<h2>
			Match #{data.matchScoutingEntry.match_number}, Team #{data.matchScoutingEntry.team_key.substring(
				3
			)}
		</h2>
		<s1>
			{data.team.nickname}
			{#if data.team.city && data.team.state_prov}
				<span class="unimportant">from {data.team.city}, {data.team.state_prov}</span>
			{:else if data.team.city && data.team.country}
				<span class="unimportant">from {data.team.city}, {data.team.country}</span>
			{/if}
		</s1>
	</Card>
</div>
<ScoutingForm
	bind:allDefaultValues
	layout={data.layout}
	bind:formData
	teamNumber={data.team.team_number}
/>

<BottomNavBar variant="static" bind:bottomAppBar items={bottomBarActions} />
