<script lang="ts">
	import { encodeMatchScouting } from '$lib/compression';
	import db, { type MatchScoutingLocal } from '$lib/localDB';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	import { event_key, org_key } from '$lib/stores';
	import Paper from '@smui/paper';
	import Select, { Option } from '@smui/select';
	import { liveQuery } from 'dexie';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	
	let snackbar: SimpleSnackbar;
	
	onMount(async () => {
		// console.log(lzma);
		db.matchscouting
			.where({
				event_key: $event_key,
				org_key: $org_key
			})
			.limit(60)
			.sortBy('time')
			.then(async (data) => {
				console.log('Compressing data')
				let byteArray = await encodeMatchScouting(data);
				console.log('Creating canvas')
				QRCode.toCanvas(
					canvas,
					[{data: byteArray, mode: 'byte'}],
					{
						errorCorrectionLevel: 'medium'
					},
					function (err) {
						if (err) snackbar.error(JSON.stringify(err));
					}
				);
			});
	});
</script>

<section class="pad">
	<canvas bind:this={canvas} />
</section>

<SimpleSnackbar bind:this={snackbar} />

<style lang="scss">
	canvas {
		// i'll do something more fancy later
		margin: auto;
		display: block;
	}
</style>
