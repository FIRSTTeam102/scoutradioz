<script lang="ts">
	import assert from '$lib/assert';
	import { encodeMatchScouting, encodeMetadata, decode } from '$lib/compression';
	import db, { type MatchScoutingLocal } from '$lib/localDB';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	import { event_key, org_key } from '$lib/stores';
	import Paper from '@smui/paper';
	import Select, { Option } from '@smui/select';
	import { liveQuery, type Observable } from 'dexie';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;

	let snackbar: SimpleSnackbar;

	let numMatchesToGrab: number;
	
	let qrCodeType: 'matchscouting'|'metadata' = 'matchscouting';

	// Todo: instead of depending on lightmatches, create a picker based on the empty matchscouting entries, with a start # and end #
	let numMatchesAtEvent: Observable<number>;
	$: numMatchesAtEvent = liveQuery(async () => {
		let number = await db.lightmatches
			.where({
				event_key: $event_key,
				comp_level: 'qm'
			})
			.count();

		// By default, set numMatchesToGrab = 10 or total # of matches, whichever is smaller
		numMatchesToGrab = Math.min(number, 10);

		return number;
	});

	$: 
		if (qrCodeType === 'matchscouting') {
			db.matchscouting
				.where({
					event_key: $event_key,
					org_key: $org_key
				})
				.limit(numMatchesToGrab * 6)
				.sortBy('time')
				.then(async (data) => {
					if (data.length > 0) {
						console.log('Compressing data');
						let base64Data = await encodeMatchScouting(data);
						generateQR(base64Data);
						let decoded = await decode(base64Data);
						console.log('Orig', data);
						console.log(decoded);
					}
				});
		}
		else if (qrCodeType === 'metadata') {
			((async () => {
				assert(typeof $org_key === 'string' && typeof $event_key === 'string');
				
				const users = await db.lightusers.where('org_key').equals($org_key)
					.filter(user => user.event_info.assigned || user.event_info.present)
					.limit(20)
					.toArray();
				
				const event = await db.events.where('key').equals($event_key).first();
				if (!event) {
					snackbar.error('Could not find event details!');
					return clearCanvas();
				}
				const teams = await db.teams.where('key').anyOf(event.team_keys).toArray();
				if (!teams) {
					snackbar.error('Could not find list of teams at the event!');
					return clearCanvas();
				};
				
				const org = await db.orgs.where('org_key').equals($org_key).first();
				assert(org, 'Could not find org in db');
				
				let base64Data = await encodeMetadata(org, users, teams);
				generateQR(base64Data);
				let decoded = await decode(base64Data);
				console.log(org, users, teams);
				console.log(decoded);
			}))();
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
					)
				}
			}
		);
	}
</script>

<section class="pad columns center" style="gap: 1em;">
	<div class="rows" style="gap: 1em;">
		<div>
			<Select variant="filled" bind:value={qrCodeType}>
				<Option value='matchscouting'>Match scouting</Option>
				<Option value="metadata">Users & team nicknames</Option>
			</Select>
		</div>
		<!-- JL note: not using an if block because numMatchesToGrab becomes undefined when the select is unmounted -->
		<div class:hidden={qrCodeType !== 'matchscouting'}>
			<Select variant="filled" bind:value={numMatchesToGrab} label="Matches">
				<!-- <Option value="" /> -->
				{#each Array($numMatchesAtEvent) as _, index}
					<!-- Blocks of 5 OR total # of matches -->
					{#if (index === $numMatchesAtEvent - 1 || (index + 1) % 5 === 0) && index > 0}
						<Option value={index + 1}>{index + 1}</Option>
					{/if}
				{/each}

				<svelte:fragment slot="helperText">Number of matches to display</svelte:fragment>
			</Select>
		</div>
	</div>
	<canvas bind:this={canvas} />
</section>

<SimpleSnackbar bind:this={snackbar} />

<style lang="scss">
	canvas {
		// i'll do something more fancy later
		margin: auto;
		display: block;
	}
	
	.hidden {
		display: none;
	}
</style>
