<script lang="ts">
	import assert from '$lib/assert';
	import {
		encodeMatchScouting,
		encodeMetadata,
		decode,
		encodeOneMatchScoutingResult
	} from '$lib/compression';
	import db, { type MatchScoutingLocal } from '$lib/localDB';
	import { getLogger } from '$lib/logger';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	import { event_key, org_key } from '$lib/stores';
	import Button, { Label as BLabel } from '@smui/button';
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';
	import Paper from '@smui/paper';
	import Select, { Option } from '@smui/select';
	import { liveQuery, type Observable } from 'dexie';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;

	let snackbar: SimpleSnackbar;

	let onlyUnsyncedMatches = true;

	let qrCodeType: 'matchscouting' | 'pitscouting' = 'matchscouting';
	
	const logger = getLogger('sync/ScouterQRCode');

	$: matchscouting = liveQuery(async () => {
		logger.debug('updating now', onlyUnsyncedMatches);
		return db.matchscouting
			.where({
				org_key: $org_key,
				event_key: $event_key
			})
			.and((match) => !!match.data && !(onlyUnsyncedMatches && match.synced))
			.toArray();
	});
	let matchToShowQr: MatchScoutingLocal | null = null;
	$: selectedEntrySynced = (qrCodeType === 'matchscouting') ? matchToShowQr?.synced : false;

	// This block is to update matchToShowQr when a match is marked/unmarked as synced,
	// 	because it doesn't automatically happen since it's done outside of the Select
	// TODO: figure why it sometimes fires twice
	$: if (
		// if one is currently selected
		matchToShowQr &&
		// and if, after matchscouting is updated, the selected match can no longer be found in the list
		// !$matchscouting.find((match) => match.match_team_key === matchToShowQr?.match_team_key)
		!$matchscouting.includes(matchToShowQr) // JL note: I think the Select list uses references, rather than key matches, so I need to use .includes instead of .find
	) {
		if ($matchscouting.length > 0) {
			logger.debug('Updating matchToShowQr reference (setting to first in list)');
			matchToShowQr = $matchscouting[0]; // if there's some left in the list, select the first one
		} else {
			logger.debug('Updating matchToShowQr reference (setting to null)');
			matchToShowQr = null; // otherwise, unselect a match
		}
	}

	$: if (qrCodeType === 'matchscouting' && matchToShowQr) {
		encodeOneMatchScoutingResult(matchToShowQr).then((base64Data) => {
			generateQR(base64Data);
		});
	}

	function clearCanvas() {
		console.trace();
		let ctx = canvas.getContext('2d');
		ctx?.clearRect(0, 0, canvas.width, canvas.height);
	}

	function generateQR(data: string) {
		QRCode.toCanvas(
			canvas,
			data,
			{
				errorCorrectionLevel: 'medium'
			},
			function (err) {
				if (err) {
					logger.debug(err);
					logger.debug('Attempting to generate QR code with a lower error correction level');
					// Try with a lower error correction level
					QRCode.toCanvas(
						canvas,
						data,
						{
							errorCorrectionLevel: 'low'
						},
						function (err) {
							// Give up
							if (err) {
								snackbar.error(JSON.stringify(err));
								clearCanvas();
							}
						}
					);
				}
			}
		);
	}

	let matchscoutingGetKey = (match: MatchScoutingLocal) => {
		if (!match) return '';
		return match.match_team_key;
	};
</script>

<section class="pad columns center" style="gap: 1em;">
	<div class="rows" style="gap: 1em;">
		<div>
			<Select variant="filled" bind:value={qrCodeType}>
				<Option value="matchscouting">Match scouting</Option>
				<Option value="pitscouting">Pit scouting</Option>
			</Select>
		</div>
		<!-- JL note: not using an if block because numMatchesToGrab becomes undefined when the select is unmounted -->
		<div class:hidden={qrCodeType !== 'matchscouting'}>
			<Select variant="filled" bind:value={matchToShowQr} label="Match" key={matchscoutingGetKey}>
				<Option value={null} />
				{#if $matchscouting}
					{#each $matchscouting as match (match.match_team_key)}
						<Option value={match}
							>Match {match.match_number} Team {match.team_key.substring(3)} ({match.alliance})
							(synced: {!!match.synced})</Option
						>
					{/each}
				{/if}
				<svelte:fragment slot="helperText">Matches that have data</svelte:fragment>
			</Select>
			<div>
				<FormField>
					<Checkbox bind:checked={onlyUnsyncedMatches} />
					<span slot="label">Only not-synced matches</span>
				</FormField>
			</div>
		</div>
		<div class:hidden={qrCodeType !== 'pitscouting'} />
	</div>
	{#if qrCodeType === 'matchscouting' && matchToShowQr}
		<h3>
			Match {matchToShowQr.match_number} Team {matchToShowQr.team_key.substring(3)} ({matchToShowQr.alliance})
		</h3>
	{/if}
	<div class="canvas-parent">
		<canvas bind:this={canvas} />
	</div>
	<div class:hidden={qrCodeType !== 'matchscouting' || !matchToShowQr}>
		<Button
			variant="unelevated"
			disabled={selectedEntrySynced}
			on:click={async () => {
				if (!matchToShowQr) return;
				selectedEntrySynced = true;
				await db.matchscouting.update(matchToShowQr.match_team_key, {
					synced: true
				});
				logger.debug('Done with db update');
			}}
		>
			<BLabel>Mark as synced/received</BLabel>
		</Button>
		<Button
			variant="unelevated"
			disabled={!selectedEntrySynced}
			on:click={async () => {
				if (!matchToShowQr) return;
				selectedEntrySynced = false; // JL note: i think this has to be before db.matchscouting.update, otherwise the $: code that updates selectedEntrySynced higher up will be overridden if matchToShowQr changes
				await db.matchscouting.update(matchToShowQr.match_team_key, {
					synced: false
				});
				logger.debug('Done with db update');
			}}
		>
			<BLabel>Mark as not synced</BLabel>
		</Button>
	</div>
</section>

<SimpleSnackbar bind:this={snackbar} />

<style lang="scss">
	.canvas-parent {
		max-width: 100vw;
		margin: auto;
	}
	canvas {
		// i'll do something more fancy later
		max-width: 100%;
		aspect-ratio: 1;
		height: unset !important; // override height set by QRCode
	}

	.hidden {
		display: none;
	}
</style>
