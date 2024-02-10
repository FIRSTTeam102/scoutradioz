<script lang="ts">
	import { goto } from '$app/navigation';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import { msg } from '$lib/i18n';
	import db from '$lib/localDB';
	import { getLogger } from '$lib/logger';
	import BottomNavBar, { type NavBarItem } from '$lib/nav/BottomNavBar.svelte';
	import { getNewSubmissionHistory } from '$lib/utils';
	import type BottomAppBar from '@smui-extra/bottom-app-bar';
	import type { PageData } from './$types';

	export let data: PageData;

	const logger = getLogger('scouting/pit/form');

	let bottomAppBar: BottomAppBar;

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
		db.pitscouting.update({...data.pitScoutingEntry}, {
			data: allDefaultValues ? undefined : data.pitScoutingEntry.data,
			synced: false,
			actual_scouter: scouterRecord
		});
	}

	let bottomBarActions: NavBarItem[] = [
		{
			onClick: async () => {
				// TODO: use nice dialog instead of confirm()
				if (
					confirm(
						'Really reset the data from this assignment? (The changes will only be local; this action will not delete data on the server if it exists)'
					)
				) {
					logger.info(`Discarding form data from team ${data.pitScoutingEntry.team_key}`);
					await db.pitscouting.update(data.pitScoutingEntry, {
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
				// Intentional design decision: Keep data undefined (as controlled in the $: block above)
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

				// 2024-02-09 JL: Disabled auto sync for pit scouting because we don't want to show a qr code at the end of each match,
				// 	so it would be a little weird to show a popup just for the auto sync, and it would be a lot of work to do a background
				// 	sync task manager thing, and we don't want to freeze the screen while it's doing a background sync.
				// 	Maybe todo: add a FAB in the pit scouting dashboard screen for uploading the completed assignments and qr code
				
				// if ($deviceOnline) {
				// 	logger.debug('device online; going to attempt a cloud sync!');
				// 	// retrieve the full entry once more
				// 	let entry = await db.pitscouting
				// 		.where({
				// 			org_key: data.org_key,
				// 			event_key: data.event_key,
				// 			team_key: data.key
				// 		})
				// 		.first();
				// 	let bulkWriteResult = (await fetchJSON(`/api/orgs/${data.org_key}/${data.event_key}/submit/pit`, {
				// 		body: JSON.stringify([entry]),
				// 		method: 'POST'
				// 	})) as BulkWriteResult;
				// 	logger.info('bulkWriteResult: ', bulkWriteResult);
				// 	// if submitted successfully, mark this local pit scouting entry as synced
				// 	if (bulkWriteResult.ok) {
				// 		await db.pitscouting.update(data.pitScoutingEntry, {
				// 			synced: true
				// 		});
				// 	}
				// }
				// else logger.info('Device offline; not attempting a cloud sync');
				goto('/scouting/pit');
			},
			label: msg('Done'),
			icon: 'done'
		},
	];
</script>

<ScoutingForm
	bind:allDefaultValues
	layout={data.layout}
	bind:formData={data.pitScoutingEntry.data}
	teamNumber={data.teamNumber}
/>

<BottomNavBar variant="static" bind:bottomAppBar items={bottomBarActions} />
