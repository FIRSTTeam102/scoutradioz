<script lang="ts">
	import assert from '$lib/assert';
	import { encodeMatchScouting, encodeMetadata, decode } from '$lib/compression';
	import db, { type MatchScoutingLocal } from '$lib/localDB';
	import { event_key, org_key } from '$lib/stores';
	import type { SnackbarContext } from '$lib/types';
	import Paper from '@smui/paper';
	import Select, { Option } from '@smui/select';
	import { liveQuery, type Observable } from 'dexie';
	import QRCode from 'qrcode';
	import { getContext, onMount } from 'svelte';

	let canvas: HTMLCanvasElement;

	let snackbar = getContext('snackbar') as SnackbarContext;

	let numMatchesToGrab: number;
	let whichUsersToInclude: 'assigned' | 'everyone' = 'assigned';

	let qrCodeType: 'matchscouting' | 'metadata' = 'matchscouting';

	const NUM_MATCHES_GROUP = 3;

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
		numMatchesToGrab = Math.min(number, NUM_MATCHES_GROUP * 2);

		return number;
	});

	function getHackyCurrentMatchNumber() {
		return parseInt(localStorage.getItem(`match_number_${$event_key}`) || '1');
	}

	let matchscouting: MatchScoutingLocal[] | undefined = undefined;

	$: if (qrCodeType === 'matchscouting' && numMatchesToGrab > 0) {
		console.log(getHackyCurrentMatchNumber());
		db.matchscouting
			.orderBy('match_number')
			.filter(
				(match) =>
					match.event_key === $event_key &&
					match.org_key === $org_key &&
					match.match_number >= getHackyCurrentMatchNumber()
			)
			.limit(numMatchesToGrab * 6)
			.toArray()
			.then(async (data) => {
				if (data.length > 0) {
					matchscouting = data;
					console.log('Compressing data');
					let base64Data = await encodeMatchScouting(data);
					console.log(base64Data);
					generateQR(base64Data);
					// console.log('Orig', data);
					// let decoded = await decode(base64Data);
					// console.log(decoded);
				} else {
					matchscouting = undefined;
					snackbar.error(
						'Couldn\'t find matches. Try going back to the matches screen & decreasing the "current match number" or downloading from the "Server" tab.'
					);
				}
			});
	} else if (qrCodeType === 'metadata') {
		(async () => {
			assert(typeof $org_key === 'string' && typeof $event_key === 'string');

			const users = await db.lightusers
				.where('org_key')
				.equals($org_key)
				.filter((user) => {
					if (whichUsersToInclude === 'everyone') return true;
					return user.event_info.assigned === true || user.event_info.present === true;
				})
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
			}

			const org = await db.orgs.where('org_key').equals($org_key).first();
			assert(org, 'Could not find org in db');

			let base64Data = await encodeMetadata(org, users, teams, event);
			generateQR(base64Data);
			// let decoded = await decode(base64Data);
			// console.log(org, users, teams);
			// console.log(decoded);
		})();
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
					console.log(err);
					console.log('Attempting to generate QR code with a lower error correction level');
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

	const numMatchesGetKey = (num: number) => String(num);
</script>

<section class="pad columns center" style="gap: 1em;">
	<div class="rows" style="gap: 1em;">
		<div>
			<Select variant="filled" bind:value={qrCodeType}>
				<Option value="matchscouting">Match scouting</Option>
				<Option value="metadata">Users & team nicknames</Option>
			</Select>
		</div>
		<!-- JL note: not using an if block because numMatchesToGrab becomes undefined when the select is unmounted -->
		<div class:hidden={qrCodeType !== 'matchscouting'}>
			<Select variant="filled" bind:value={numMatchesToGrab} label="Matches" key={numMatchesGetKey}>
				<!-- JL note: the " || 50" is to guarantee that there are some options in the select to avoid numMatchesToGrab becoming undefined -->
				{#each Array($numMatchesAtEvent || 50) as _, index}
					<!-- Blocks of 5 OR total # of matches -->
					{#if (index === ($numMatchesAtEvent || 50) - 1 || (index + 1) % NUM_MATCHES_GROUP === 0) && index > 0}
						<Option value={index + 1}>{index + 1}</Option>
					{/if}
				{/each}

				<svelte:fragment slot="helperText">Number of matches to display</svelte:fragment>
			</Select>
		</div>
		<div class:hidden={qrCodeType !== 'metadata'}>
			<Select variant="filled" bind:value={whichUsersToInclude}>
				<Option value="everyone">Everyone</Option>
				<Option value="assigned">Only assigned & present</Option>
				<svelte:fragment slot="helperText">Whom to include in the QR code</svelte:fragment>
			</Select>
		</div>
	</div>
	<div class="canvas-parent">
		{#if qrCodeType === 'matchscouting' && matchscouting}
			<h3 style='margin-bottom: 8px;'>
				Matches # {matchscouting[0].match_number} - {matchscouting[matchscouting.length - 1]
					.match_number}
			</h3>
			<p>
				To change the current match number, go to the match scouting screen and increment/decrement the # there.
			</p>
		{/if}
		<canvas bind:this={canvas} />
	</div>
</section>

<style lang="scss">
	.canvas-parent {
		text-align: center;
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
