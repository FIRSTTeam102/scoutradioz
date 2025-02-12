<script lang="ts">
	import { goto } from '$app/navigation';
	import { encodeOneMatchScoutingResult } from '$lib/compression';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import { msg } from '$lib/i18n';
	import db, { type MatchScoutingLocal, type ScouterRecordLocal, type TeamLocal, type str } from '$lib/localDB';
	import { getLogger } from '$lib/logger';
	import BottomNavBar, { type NavBarItem } from '$lib/nav/BottomNavBar.svelte';
	import { canAutoSync } from '$lib/stores';
	import {
		addRefreshButtonFunctionality,
		fetchJSON,
		getNewSubmissionHistory,
		getPageLayoutContexts,
		matchKeyToCompLevel,
		setPageTitle
	} from '$lib/utils';
	import type BottomAppBar from '@smui-extra/bottom-app-bar';
	import Card from '@smui/card';
	import CircularProgress from '@smui/circular-progress';
	import { classMap } from '@smui/common/internal';
	import LinearProgress from '@smui/linear-progress';
	import type { BulkWriteResult } from 'mongodb';
	import type { Layout } from 'scoutradioz-types';
	import type { PageData } from './$types';

	import { FormLayoutOperations } from '$lib/DBOperations';
	import QrCodeDisplay from '$lib/QrCodeDisplay.svelte';
	import Button, { Icon, Label } from '@smui/button';
	import Checkbox from '@smui/checkbox';
	import Dialog, { Actions, Content, Header, Title } from '@smui/dialog';
	import FormField from '@smui/form-field';
	import assert from '$lib/assert';
	import { initializeFormData } from '$lib/form/ScoutingFormUtils';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	setPageTitle(msg('scouting.match'));

	// popup for the qr code thingy, TODO: put into separate component
	let qrDialogOpen = $state(false);
	let base64Data: Promise<string> | string = $state('');
	let scannedByScoutingLead = $state(false);

	let cloudUploadPromise: Promise<BulkWriteResult> | undefined = $state(undefined);

	const logger = getLogger('scouting/match/form');

	let bottomAppBar: BottomAppBar;
	let matchScoutingEntry: MatchScoutingLocal|undefined = $state();
	let nextAssignment: MatchScoutingLocal | undefined = $state();
	let formData: MatchScoutingLocal['data'] = $state({});
	let team: TeamLocal|undefined = $state();
	let layout: str<Layout>[]|undefined = $state();
	let hasUpcomingBreak: boolean|undefined = $state();


	let loading = $state(true);

	async function loadData(key: string) {
		logger.info('loadData running!');
		loading = true;
		qrDialogOpen = false;
		const team_key = key.split('_')[2];

		const layoutDb = await db.layout
			.where({
				org_key: data.org_key,
				year: data.event.year,
				form_type: 'matchscouting'
			})
			.toArray();

		const matchScoutingEntryDb = await db.matchscouting
			.where({ match_team_key: key })
			.and((asg) => asg.org_key === data.org_key)
			.first();

		if (!matchScoutingEntryDb) throw new Error(`Match scouting assignment not found for key ${key}!`);

		const teamDb = await db.teams.where('key').equals(team_key).first();

		if (!teamDb) throw new Error(`Team info not found for key ${team_key}!`);

		logger.debug(
			` event_key=${data.event_key} org_key=${data.org_key} user_id=${data.user_id}, match_mumber=${matchScoutingEntryDb.match_number}`
		);

		// This user's next scouting assignment.
		const nextAssignmentsDb = await db.matchscouting
			.where({ event_key: data.event_key, org_key: data.org_key })
			.and((asg) => asg.match_number > matchScoutingEntryDb.match_number && asg.assigned_scorer?.id === data.user_id)
			.sortBy('match_number');
		const nextAssignmentDb = nextAssignmentsDb[0];
		logger.debug('nextAssignment:', nextAssignmentDb);

		// Whether their next assignment is the next match or if they have a break.
		hasUpcomingBreak = nextAssignmentDb?.match_number === matchScoutingEntryDb.match_number + 1;
		matchScoutingEntry = matchScoutingEntryDb;
		nextAssignment = nextAssignmentDb;
		team = teamDb;
		layout = layoutDb;
		formData = initializeFormData(layout, matchScoutingEntry.data) as MatchScoutingLocal['data'];
		logger.info('loadData done! setting loading = false');
		loading = false;
	}

	// When formData changes (any time a form is edited), update the matchscouting entry in the database
	// 	If all of the forms are at their default values, then set data undefined
	function onFormChange() {
		assert(matchScoutingEntry);
		logger.info(`Updating formData in the database`, formData);
		db.matchscouting.update(matchScoutingEntry.match_team_key, {
			// 2024-02-25 JL: disabled setting data to undefined - hopefully shouldn't break other logic cuz completed is marked as false
			// data: allDefaultValues ? undefined : formData,
			actual_scorer: scouterRecord,
			synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
			completed: false // Additionally, if it's been changed since the last time the done button is pressed, mark it as not completed
		});
	}

	let bottomBarActions: NavBarItem[] = [
		// Discard
		{
			label: msg('Discard'),
			icon: 'delete',
			onClick: async () => {
				assert(matchScoutingEntry);
				// TODO: use nice dialog instead of confirm()
				if (
					confirm(
						'Really reset the data from this match? (The changes will only be local; this action will not delete data on the server if it exists)'
					)
				) {
					logger.info(`Discarding form data from match ${matchScoutingEntry.match_team_key}`);
					await db.matchscouting.update(matchScoutingEntry.match_team_key, {
						data: undefined,
						actual_scorer: undefined,
						synced: false,
						completed: false,
						history: getNewSubmissionHistory(matchScoutingEntry, data.user._id, data.user.name)
					});
					goto('/scouting/match');
				}
			}
		},
		// Done
		{
			label: msg('Done'),
			icon: 'done',
			onClick: async () => {
				assert(matchScoutingEntry);
				if (!data.user_id || !data.user_name) {
					throw logger.error('Not logged in! This should have been handled in +page.ts');
				}
				logger.info(`Saving actual_scorer for match acouting key ${matchScoutingEntry.match_team_key}`);
				logger.trace('formData', formData);
				// Intentional design decision: Write data to the local db when they hit the check/done button even if
				// 	the data are at defaults, because in cases where a robot no-shows, some orgs might not have
				// 	checkboxes like no-show / died during match, so some orgs might accept empty forms
				await db.matchscouting.update(matchScoutingEntry.match_team_key, {
					actual_scorer: {
						id: data.user_id,
						name: data.user_name
					},
					data: $state.snapshot(formData),
					completed: true,
					synced: false, // since the entry is being updated locally, we must force synced=false until it definitely is synced
					history: getNewSubmissionHistory(matchScoutingEntry, data.user._id, data.user.name)
				});

				let entry = await db.matchscouting.where('match_team_key').equals(matchScoutingEntry.match_team_key).first();
				if (!entry) return;

				if ($canAutoSync) {
					logger.debug('navigator.onLine = true; going to attempt a cloud sync myself');

					// Save a promise for use in the sync display thingy in the qr code popup
					cloudUploadPromise = new Promise(async (resolve, reject) => {
						let bulkWriteResult = (await fetchJSON(`/api/orgs/${data.org_key}/${data.event_key}/submit/match`, {
							body: JSON.stringify([entry]),
							method: 'POST'
						})) as BulkWriteResult;
						logger.info('bulkWriteResult: ', bulkWriteResult);
						// If submitted successfully, mark this local match scouting entry as synced
						if (bulkWriteResult.ok) {
							assert(matchScoutingEntry);
							await db.matchscouting.update(matchScoutingEntry.match_team_key, {
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
			}
		}
	];

	const { snackbar } = getPageLayoutContexts();
	addRefreshButtonFunctionality(async () => {
		const changed = await FormLayoutOperations.download('match');
		if (changed) snackbar.open(msg('cloudsync.newDataDownloaded'), 4000);
		else snackbar.open(msg('cloudsync.upToDate'), 4000);
	}, msg('cloudsync.layoutTooltip'));
	let scouterRecord = $derived({
		id: data.user_id,
		name: data.user_name
	} as ScouterRecordLocal);
	
	$effect(() => {
		if (data.key) loadData(data.key);
	});
</script>

<!-- We have to make sure matchScoutingEntry and team have loaded before allowing the html to load. -->
<!-- Note: the reason I didn't do {#if loading === false} is because I think it would destroy and recreate
	the Svelte components while loading === true, which is not necessary -->
{#if matchScoutingEntry && team}
	<div class="grid mt-4">
		<Card
			padded
			class={classMap({
				'place-self-center': true,
				'bg-red-600': matchScoutingEntry.alliance === 'red',
				'bg-blue-600': matchScoutingEntry.alliance === 'blue'
			})}>
			<h2>
				{msg('scouting.matchHeading', {
					match: matchScoutingEntry.match_number,
					team: matchScoutingEntry.team_key.substring(3)
				})}
			</h2>
			<s1>
				{#if team.city && (team.state_prov || team.country)}
					{@html msg('scouting.subheading', {
						team: team.nickname,
						city: team.city,
						state: team.state_prov || team.country || ''
					})}
				{:else}
					{team.nickname}
				{/if}
			</s1>
		</Card>
	</div>
	<!-- Destroy and recreate the ScoutingForm whenever the match-team key changes -->
	{#key data.key}
		<!-- There's a few milliseconds where formData and team are not defined while the data is loading, 
			so we need to only create the ScoutingForm when loading is set to false -->
		{#if loading === false && layout && formData}
			<ScoutingForm {layout} bind:formData teamNumber={team.team_number} onchange={onFormChange} />
		{/if}
	{/key}

	<Dialog bind:open={qrDialogOpen} aria-labelledby="simple-title" aria-describedby="simple-content">
		<Header>
			<Title
				>{msg('reports.match', {
					level: msg(`matchType.${matchKeyToCompLevel(matchScoutingEntry.match_key)}`),
					number: matchScoutingEntry.match_number
				})}
				<br />
				{msg('alliance.red')} - {msg('scouting.pitHeading', {
					team: matchScoutingEntry.team_key.substring(3)
				})}
			</Title>
		</Header>
		<Content class="grid grid-cols-1 gap-2">
			<div>
				{msg('scouting.completedBy', {
					user:
						data.user_name || 'Unknown' /* JL note: user_name should not be undefined b/c +layout.ts checks for it */
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
					onchange={() => {
						assert(matchScoutingEntry);
						// JL TODO: Maybe add syncedToCloud boolean as another check to determine whether to set synced=false when checkbox unchecked
						logger.debug(`Updating db entry synced=${scannedByScoutingLead}`);
						db.matchscouting.update(matchScoutingEntry.match_team_key, {
							synced: scannedByScoutingLead
						});
					}} 
				/>
				{#snippet label()}
					<span class="py-4">{msg('scouting.scannedByScoutingLead')}</span>
				{/snippet}
			</FormField>
		</Content>
		<Actions class="grid grid-cols-2">
			<!-- Back to list link -->
			<Button href="/scouting/match">
				<Icon class="material-icons">done</Icon>
				<Label>{msg('scouting.backToList')}</Label>
			</Button>
			<!-- Next assignment button -->
			{#if nextAssignment}
				<Button
					onclick={() => {
						if (!nextAssignment) throw new Error('nextAssignment undefined on click handler!');
						if (hasUpcomingBreak) {
						}
						// JL TODO: check whether I should set cloudUploadPromise = undefined
						goto(`/scouting/match/${nextAssignment.match_team_key}`, { invalidateAll: true });
					}}>
					<Icon class="material-icons">navigate_next</Icon>
					<Label
						>{msg('scouting.nextAssignment', {
							typeShort: msg(`matchTypeShort.${matchKeyToCompLevel(nextAssignment.match_key)}`),
							number: nextAssignment.match_number,
							team: nextAssignment.team_key.substring(3)
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
{/if}
