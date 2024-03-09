<script lang="ts">
	import { page } from '$app/stores';
	import QrCodeDisplay from '$lib/QrCodeDisplay.svelte';
	import assert from '$lib/assert';
	import { decodePitScouting, encodeMatchScoutingSchedule, encodeMetadata, encodePitScouting } from '$lib/compression';
	import { msg } from '$lib/i18n';
	import db, { type MatchScoutingLocal } from '$lib/localDB';
	import { getLogger } from '$lib/logger';
	import type { SnackbarContext } from '$lib/types';
	import Select, { Option } from '@smui/select';
	import { liveQuery, type Observable } from 'dexie';
	import { getContext } from 'svelte';

	let snackbar = getContext('snackbar') as SnackbarContext;
	const logger = getLogger('LeadQRCode');

	$: event_key = $page.data.event_key as string;
	$: org_key = $page.data.org_key as string;

	let numMatchesToGrab: number;
	let whichUsersToInclude: 'assigned' | 'everyone' = 'assigned';

	let qrCodeType: 'matchscouting' | 'pitscouting' | 'metadata' = 'matchscouting';

	const NUM_MATCHES_GROUP = 3;

	let base64Data: string = '';

	// Todo: instead of depending on lightmatches, create a picker based on the empty matchscouting entries, with a start # and end #
	let numMatchesAtEvent: Observable<number>;
	$: numMatchesAtEvent = liveQuery(async () => {
		let number = await db.lightmatches
			.where({
				event_key: event_key,
				comp_level: 'qm'
			})
			.count();

		// By default, set numMatchesToGrab = 10 or total # of matches, whichever is smaller
		numMatchesToGrab = Math.min(number, NUM_MATCHES_GROUP * 2);

		return number;
	});

	function getHackyCurrentMatchNumber() {
		return parseInt(localStorage.getItem(`match_number_${event_key}`) || '1');
	}

	let firstMatchNumber = 0;
	let lastMatchNumber = 0;
	
	async function handleChange () {
		console.log('func running');
		try {
			if (qrCodeType === 'matchscouting' && numMatchesToGrab > 0) {
				logger.debug('Match number:', getHackyCurrentMatchNumber());
				const matchscouting = await db.matchscouting
					.orderBy('match_number')
					.filter(
						(match) =>
							match.event_key === event_key &&
							match.org_key === org_key &&
							match.match_number >= getHackyCurrentMatchNumber()
					)
					.limit(numMatchesToGrab * 6)
					.toArray();
				const syncstatus = await db.syncstatus
					.where({ table: 'matchscouting', filter: `org=${org_key},event=${event_key}` })
					.first();
				assert(
					syncstatus && syncstatus.data?.checksum,
					'syncstatus / checksum could not be found!'
				);

				if (matchscouting.length > 0) {
					logger.debug('Compressing data');

					firstMatchNumber = matchscouting[0].match_number;
					lastMatchNumber = matchscouting[matchscouting.length - 1].match_number;

					base64Data = await encodeMatchScoutingSchedule(matchscouting, syncstatus.data.checksum);
				} else {
					firstMatchNumber = 0;
					lastMatchNumber = 0;
					throw new Error(
						'Couldn\'t find matches. Try going back to the matches screen & decreasing the "current match number" or downloading from the "Server" tab.'
					);
				}
			} else if (qrCodeType === 'pitscouting') {
				assert(typeof org_key === 'string' && typeof event_key === 'string');

				const pitscouting = await db.pitscouting.where({ org_key, event_key }).toArray();

				const syncstatus = await db.syncstatus
					.where({ table: 'pitscouting', filter: `org=${org_key},event=${event_key}` })
					.first();
				assert(
					syncstatus && syncstatus.data?.checksum,
					'syncstatus / checksum could not be found!'
				);

				base64Data = await encodePitScouting(pitscouting, syncstatus.data.checksum);
			} else if (qrCodeType === 'metadata') {
				assert(typeof org_key === 'string' && typeof event_key === 'string');

				const users = await db.lightusers
					.where('org_key')
					.equals(org_key)
					.filter((user) => {
						if (whichUsersToInclude === 'everyone') return true;
						return user.event_info.assigned === true || user.event_info.present === true || user.name === 'default_user';
					})
					.toArray();

				const event = await db.events.where('key').equals(event_key).first();
				if (!event) {
					snackbar.error('Could not find event details!');
					base64Data = '';
					return;
				}
				const teams = await db.teams.where('key').anyOf(event.team_keys).toArray();
				if (!teams) {
					snackbar.error('Could not find list of teams at the event!');
					base64Data = '';
					return;
				}

				const org = await db.orgs.where('org_key').equals(org_key).first();
				assert(org, 'Could not find org in db');

				base64Data = await encodeMetadata(org, users, teams, event);
			}
			else base64Data = '';
		} catch (err) {
			snackbar.error(String(err));
			base64Data = '';
		}
	}

	const numMatchesGetKey = (num: number) => String(num);
</script>

<section class="pad grid grid-cols-1 place-items-center gap-4">
	<div class="grid grid-cols-2 gap-4">
		<div>
			<Select variant="filled" bind:value={qrCodeType} on:MDCSelect:change={handleChange}>
				<Option value="matchscouting">{msg('scouting.match')}</Option>
				<Option value="pitscouting">{msg('scouting.pit')}</Option>
				<Option value="metadata">{msg('qrsync.usersAndTeams')}</Option>
			</Select>
		</div>
		<!-- JL note: not using an if block because numMatchesToGrab becomes undefined when the select is unmounted -->
		<div class:hidden={qrCodeType !== 'matchscouting'}>
			<Select variant="filled" bind:value={numMatchesToGrab} label="Matches" key={numMatchesGetKey} on:MDCSelect:change={handleChange}>
				<!-- JL note: the " || 50" is to guarantee that there are some options in the select to avoid numMatchesToGrab becoming undefined -->
				{#each Array($numMatchesAtEvent || 50) as _, index}
					<!-- Blocks of 5 OR total # of matches -->
					{#if (index === ($numMatchesAtEvent || 50) - 1 || (index + 1) % NUM_MATCHES_GROUP === 0) && index > 0}
						<Option value={index + 1}>{index + 1}</Option>
					{/if}
				{/each}

				<svelte:fragment slot="helperText">{msg('qrsync.numMatchesToDisplay')}</svelte:fragment>
			</Select>
		</div>
		<div class:hidden={qrCodeType !== 'metadata'}>
			<Select variant="filled" bind:value={whichUsersToInclude}>
				<Option value="everyone">{msg('qrsync.everyone')}</Option>
				<Option value="assigned">{msg('qrsync.onlyAssignedAndPresent')}</Option>
				<svelte:fragment slot="helperText">{msg('qrsync.whomToInclude')}</svelte:fragment>
			</Select>
		</div>
	</div>
	{#if qrCodeType === 'matchscouting' && firstMatchNumber}
		<div class="text-center">
			<h3>{msg('qrsync.matchesRange', {first: firstMatchNumber, last: lastMatchNumber})}</h3>
			<p>
				To change the current match number, go to the
				<a href="/scouting/match">match scouting screen</a>
				and increment/decrement the # there.
			</p>
		</div>
	{:else if qrCodeType === 'pitscouting'}
		<div class="text-center">
			<h3>{msg('scouting.pit')}</h3>
		</div>
	{/if}
	<QrCodeDisplay data={base64Data} />
</section>
