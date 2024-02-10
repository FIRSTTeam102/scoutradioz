<script lang="ts">
	import { goto } from '$app/navigation';
	import { encodeOneMatchScoutingResult } from '$lib/compression';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import { msg } from '$lib/i18n';
	import db from '$lib/localDB';
	import { getLogger } from '$lib/logger';
	import BottomNavBar, { type NavBarItem } from '$lib/nav/BottomNavBar.svelte';
	import { canAutoSync } from '$lib/stores';
	import { fetchJSON, getNewSubmissionHistory, matchKeyToCompLevel } from '$lib/utils';
	import type BottomAppBar from '@smui-extra/bottom-app-bar';
	import Card from '@smui/card';
	import CircularProgress from '@smui/circular-progress';
	import LinearProgress from '@smui/linear-progress';
	import type { BulkWriteResult } from 'mongodb';
	import type { PageData } from './$types';
	import { classMap } from '@smui/common/internal';

	import QrCodeDisplay from '$lib/QrCodeDisplay.svelte';
	import Button, { Icon, Label } from '@smui/button';
	import Checkbox from '@smui/checkbox';
	import Dialog, { Actions, Content, Header, Title } from '@smui/dialog';
	import FormField from '@smui/form-field';

	export let data: PageData;

	// popup for the qr code thingy, TODO: put into separate component
	let qrDialogOpen = false;
	let base64Data: Promise<string> | string;
	let scannedByScoutingLead = false;

	let cloudUploadPromise: Promise<BulkWriteResult> | undefined = undefined;

	const logger = getLogger('scouting/match/form');

	let bottomAppBar: BottomAppBar;

	let allDefaultValues: boolean;

	$: scouterRecord = {
		id: data.user_id,
		name: data.user_name
	};

	// When formData changes (any time a form is edited), update the matchscouting entry in the database
	// 	If all of the forms are at their default values, then set data undefined
	$: {
		logger.trace(`Updating formData in the database - allDefault=${allDefaultValues}`);
		db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
			data: allDefaultValues ? undefined : data.matchScoutingEntry.data,
			synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
			completed: false, // Additionally, if it's been changed since the last time the done button is pressed, mark it as not completed
			actual_scorer: scouterRecord
		});
	}

	let bottomBarActions: NavBarItem[] = [
		// Discard
		{
			onClick: async () => {
				// TODO: use nice dialog instead of confirm()
				if (
					confirm(
						'Really reset the data from this match? (The changes will only be local; this action will not delete data on the server if it exists)'
					)
				) {
					logger.info(`Discarding form data from match ${data.matchScoutingEntry.match_team_key}`);
					await db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
						data: undefined,
						actual_scorer: undefined,
						synced: false,
						completed: false,
						history: getNewSubmissionHistory(data.matchScoutingEntry, data.user._id, data.user.name)
					});
					goto('/scouting/match');
				}
			},
			label: msg('Discard'),
			icon: 'delete'
		},
		// Done
		{
			onClick: async () => {
				if (!data.user_id || !data.user_name) {
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
						id: data.user_id,
						name: data.user_name
					},
					data: data.matchScoutingEntry.data,
					completed: true,
					synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
					history: getNewSubmissionHistory(data.matchScoutingEntry, data.user._id, data.user.name)
				});

				let entry = await db.matchscouting
					.where('match_team_key')
					.equals(data.matchScoutingEntry.match_team_key)
					.first();
				if (!entry) return;

				if ($canAutoSync) {
					logger.debug('navigator.onLine = true; going to attempt a cloud sync myself');

					// Save a promise for use in the sync display thingy in the qr code popup
					cloudUploadPromise = new Promise(async (resolve, reject) => {
						let bulkWriteResult = (await fetchJSON(
							`/api/orgs/${data.org_key}/${data.event_key}/submit/match`,
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
							resolve(bulkWriteResult);
							// Since the entry is now synced, we must update the QR code.
							// 	However, we should await it here before updating the string so that the user doesn't see a flash of the LinarProgress.
							logger.debug('Updating qr code with synced=true!');
							let newEntry = {
								...entry!,
								synced: true
							};
							base64Data = await encodeOneMatchScoutingResult(newEntry);
						} else {
							reject(bulkWriteResult);
						}
					});
				} else {
					logger.info('Device offline; not attempting a cloud sync');
					cloudUploadPromise = undefined; // make sure it's not defined for when the QR code dialog opens
				}
				base64Data = encodeOneMatchScoutingResult(entry);
				qrDialogOpen = true;
			},
			label: msg('Done'),
			icon: 'done'
		}
	];
</script>

<div class="grid mt-4">
	<Card
		padded
		class={classMap({
			'place-self-center': true,
			'bg-red-600': data.matchScoutingEntry.alliance === 'red',
			'bg-blue-600': data.matchScoutingEntry.alliance === 'blue',
		})}
	>
		<h2>
			{msg('scouting.matchHeading', {
				match: data.matchScoutingEntry.match_number,
				team: data.matchScoutingEntry.team_key.substring(3)
			})}
		</h2>
		<s1>
			{#if data.team.city && (data.team.state_prov || data.team.country)}
				{@html msg('scouting.subheading', {
					team: data.team.nickname,
					city: data.team.city,
					state: data.team.state_prov || data.team.country || ''
				})}
			{:else}
				{data.team.nickname}
			{/if}
		</s1>
	</Card>
</div>
<ScoutingForm
	bind:allDefaultValues
	layout={data.layout}
	bind:formData={data.matchScoutingEntry.data}
	teamNumber={data.team.team_number}
/>

<Dialog bind:open={qrDialogOpen} aria-labelledby="simple-title" aria-describedby="simple-content">
	<Header>
		<Title
			>{msg('reports.match', {
				level: msg(`matchType.${matchKeyToCompLevel(data.matchScoutingEntry.match_key)}`),
				number: data.matchScoutingEntry.match_number
			})}
			<br />
			{msg('alliance.red')} - {msg('scouting.pitHeading', {
				team: data.matchScoutingEntry.team_key.substring(3)
			})}
		</Title>
	</Header>
	<Content class="grid grid-cols-1 gap-2">
		<div>
			{msg('scouting.completedBy', {
				user:
					data.user_name ||
					'Unknown' /* JL note: user_name should not be undefined b/c +layout.ts checks for it */
			})}
		</div>
		{#await base64Data}
			<LinearProgress indeterminate />
		{:then resolvedData}
			<QrCodeDisplay data={resolvedData} />
		{/await}
		<Card variant="outlined" class="flex-row items-center p-2">
			{#if cloudUploadPromise}
				{#await cloudUploadPromise}
					<CircularProgress indeterminate style="width: 1.5em; height: 1.5em; margin: 8px;" />
					{msg('scouting.dataUploadingToCloud')}
				{:then}
					<i class="material-icons sameSizeAsCheckbox">done</i>
					{msg('scouting.dataUploadedToCloud')}
				{/await}
			{:else}
				<i class="material-icons sameSizeAsCheckbox">cloud_off</i>
				{msg('scouting.dataSavedOffline')}
			{/if}
		</Card>
		<FormField class="pl-2 flex-row justify-center">
			<Checkbox
				bind:checked={scannedByScoutingLead}
				on:change={() => {
					// JL TODO: Maybe add syncedToCloud boolean as another check to determine whether to set synced=false when checkbox unchecked
					logger.debug(`Updating db entry synced=${scannedByScoutingLead}`);
					db.matchscouting.update(data.matchScoutingEntry.match_team_key, {
						synced: scannedByScoutingLead
					});
				}}
			/>
			<span slot="label" class="py-4">{msg('scouting.scannedByScoutingLead')}</span>
		</FormField>
	</Content>
	<Actions class="grid grid-cols-2">
		<!-- Back to list link -->
		<Button href="/scouting/match">
			<Icon class="material-icons">done</Icon>
			<Label>{msg('scouting.backToList')}</Label>
		</Button>
		<!-- Next assignment button -->
		{#if data.nextAssignment}
			<Button
				on:click={() => {
					if (data.hasUpcomingBreak) {
					}
					// JL TODO: check whether I should set cloudUploadPromise = undefined
					goto(`/scouting/match/${data.nextAssignment.match_team_key}`, { invalidateAll: true });
				}}
			>
				<Icon class="material-icons">navigate_next</Icon>
				<Label
					>{msg('scouting.nextAssignment', {
						typeShort: msg(`matchTypeShort.${matchKeyToCompLevel(data.nextAssignment.match_key)}`),
						number: data.nextAssignment.match_number,
						team: data.nextAssignment.team_key.substring(3)
					})}
				</Label>
			</Button>
		{:else}
			<Button disabled>
				<Label>{msg('scouting.noUpcomingAssignments')}</Label>
			</Button>
		{/if}
	</Actions>
</Dialog>

<BottomNavBar variant="static" bind:bottomAppBar items={bottomBarActions} />
