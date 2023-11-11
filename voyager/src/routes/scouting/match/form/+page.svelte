<script lang="ts">
	import type { PageData } from './$types';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import BottomNavBar, { type NavBarItem } from '$lib/nav/BottomNavBar.svelte';
	import BottomAppBar, { AutoAdjust } from '@smui-extra/bottom-app-bar';
	import { getLogger } from '$lib/logger';
	import db from '$lib/localDB';
	import { goto } from '$app/navigation';
	import { deviceOnline, event_key, org_key, userId, userName } from '$lib/stores';
	import { fetchJSON } from '$lib/utils';
	import type { BulkWriteResult } from 'mongodb';

	import List, { Item, Text, PrimaryText, SecondaryText, Meta } from '@smui/list';
	import Button, { Label as BLabel, Icon as BIcon } from '@smui/button';
	import Card, { Content as CContent } from '@smui/card';

	export let data: PageData;
	
	const logger = getLogger('scouting/match/form');
	
	let bottomAppBar: BottomAppBar;
	
	// Initialize formData if necessary
	let formData: Required<typeof data.matchScoutingEntry.data> = data.matchScoutingEntry.data || {};
	
	$: scouterRecord = $userId ? {
		id: $userId,
		name: $userName
	} : undefined;
	
	// When formData changes (any time a form is edited), update the matchscouting entry in the database
	// TODO: Check with initial values to see if there were any changes, before setting synced=false
	$: {
		logger.trace('Updating formData in the database');
		db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
			data: formData,
			synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
			actual_scorer: scouterRecord,
		});
	}
	
	let bottomBarActions: NavBarItem[] = [
		{
			onClick: () => {
				// TODO: use nice dialog instead of confirm()
				if (confirm('Really reset the data from this match? (The changes will only be local; this action will not delete data on the server if it exists)')) {
					logger.info(`Discarding form data from match ${data.matchScoutingEntry.match_team_key}`);
					db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
						data: undefined
					})
					goto('/scouting/match');
				}
			},
			label: 'Discard',
			icon: 'delete'
		},
		{
			onClick: async () => {
				// Save actual_scouter to db
				if ($userId && $userName) {
					logger.info(`Saving actual_scorer for match acouting key ${data.matchScoutingEntry.match_team_key}`)
					await db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
						actual_scorer: {
							id: $userId,
							name: $userName
						},
						synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
					})
				}
				else {
					logger.error('userId and userName not set!! Can\'t set actual_scouter!');
				}

				if ($deviceOnline) {
					logger.debug('navigator.onLine = true; going to attempt a cloud sync myself')
					let entry = await db.matchscouting.where('match_team_key').equals(data.matchScoutingEntry.match_team_key).first();
					let bulkWriteResult = await fetchJSON(`/api/orgs/${$org_key}/${$event_key}/submit/match`, {
						body: JSON.stringify([entry]),
						method: 'POST',
					}) as BulkWriteResult;
					logger.info('bulkWriteResult: ', bulkWriteResult);
					// If submitted successfully, mark this local match scouting entry as synced
					if (bulkWriteResult.ok ) {
						await db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
							synced: true
						});
					}
				}
				else logger.info('Device offline; not attempting a cloud sync')
				goto('/scouting/match');
			},
			label: 'Done (Back to list)',
			icon: 'done',
		},
		{
			onClick: () => {
				alert('Not implemented')
			},
			label: 'Next assignment',
			icon: 'arrow_forward',
		}
	]
	console.log('voyager\src\routes\scouting\match\form\+page.svelte:')
	console.log(JSON.stringify(data.matchScoutingEntry));
</script>

<AutoAdjust {bottomAppBar} >
	<h1>{data.matchScoutingEntry.team_key}, {data.matchScoutingEntry.alliance}</h1>
	<ScoutingForm layout={data.layout} bind:formData teamNumber={data.teamNumber} />
</AutoAdjust>

<BottomNavBar bind:bottomAppBar items={bottomBarActions} />
