<script lang="ts">
	import type { PageData } from './$types';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import BottomNavBar, { type NavBarItem } from '$lib/nav/BottomNavBar.svelte';
	import type BottomAppBar from '@smui-extra/bottom-app-bar';
	import { deviceOnline, } from '$lib/stores';
	import db from '$lib/localDB';
	import { getLogger } from '$lib/logger';
	import { goto } from '$app/navigation';
	import { fetchJSON, getNewSubmissionHistory } from '$lib/utils';
	import type { BulkWriteResult } from 'mongodb';

	export let data: PageData;

	const logger = getLogger('scouting/pit/form');

	let bottomAppBar: BottomAppBar;

	let formData: Required<typeof data.pitScoutingEntry.data> = data.pitScoutingEntry.data || {};
	let allDefaultValues: boolean;

	$: scouterRecord = {
		id: data.user._id,
		name: data.user.name,
	}

	// When formData changes (any time a form is edited), update the entry in the database
	// 	If all of the forms are at their default values, then set data undefined
	$: {
		logger.trace(`Updating formData in the database - allDefault=${allDefaultValues}`);
		// JL note: Dexie lets you pass an object in, but I think it only checks the multi-entry primary key
		// 	TS doesn't like it if I just pass the multi-entry primary key in like in a .where() call
		db.pitscouting.update(data.pitScoutingEntry, {
			data: allDefaultValues ? undefined : formData,
			synced: false,
			actual_scouter: scouterRecord
		});
	}

	let bottomBarActions: NavBarItem[] = [
		{
			onClick: () => {
				// TODO: use nice dialog instead of confirm()
				if (
					confirm(
						'Really reset the data from this assignment? (The changes will only be local; this action will not delete data on the server if it exists)'
					)
				) {
					logger.info(`Discarding form data from team ${data.pitScoutingEntry.team_key}`);
					db.pitscouting.update(data.pitScoutingEntry, {
						data: undefined,
						actual_scouter: undefined,
						synced: false,
						completed: false,
						history: getNewSubmissionHistory(data.pitScoutingEntry, data.user._id, data.user.name)
					});
					goto('/scouting/pit');
				}
			},
			label: 'Discard',
			icon: 'delete'
		},
		{
			onClick: async () => {
				logger.info(`Saving actual_scouter for pit scouting key ${data.pitScoutingEntry.team_key}`);
				// Intentional design decision: Keep data undefined (as controlled ni the $: block above)
				// 	even when hitting check/done for pit scouting, because we should never expect a form to be
				// 	completely empty when pit scouting
				await db.pitscouting.update(data.pitScoutingEntry, {
					actual_scouter: {
						id: data.user._id,
						name: data.user.name,
					},
					synced: false,
					history: getNewSubmissionHistory(data.pitScoutingEntry, data.user._id, data.user.name),
				});

				if ($deviceOnline) {
					logger.debug('device online; going to attempt a cloud sync!');
					// retrieve the full entry once more
					let entry = await db.pitscouting
						.where({
							org_key: data.org_key,
							event_key: data.event_key,
							team_key: data.key
						})
						.first();
					let bulkWriteResult = (await fetchJSON(`/api/orgs/${data.org_key}/${data.event_key}/submit/pit`, {
						body: JSON.stringify([entry]),
						method: 'POST'
					})) as BulkWriteResult;
					logger.info('bulkWriteResult: ', bulkWriteResult);
					// if submitted successfully, mark this local pit scouting entry as synced
					if (bulkWriteResult.ok) {
						await db.pitscouting.update(data.pitScoutingEntry, {
							synced: true
						});
					}
				}
				else logger.info('Device offline; not attempting a cloud sync');
				goto('/scouting/pit');
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
</script>

<ScoutingForm
	bind:allDefaultValues
	layout={data.layout}
	bind:formData
	teamNumber={data.teamNumber}
/>

<BottomNavBar variant="static" bind:bottomAppBar items={bottomBarActions} />
