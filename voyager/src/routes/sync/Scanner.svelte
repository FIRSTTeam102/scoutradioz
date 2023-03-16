<script lang="ts">
	import Paper from '@smui/paper';
	import QrCodeScanner from '$lib/QrCodeScanner.svelte';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	import { decode, decodeMatchScouting } from '$lib/compression';
	import type { LightUser, MatchScoutingLocal, str, TeamLocal } from '$lib/localDB';
	import db from '$lib/localDB';
	import type { Org } from 'scoutradioz-types';

	let qrcodeEnabled = true;

	let snackbar: SimpleSnackbar;

	async function onQrCodeData(e: CustomEvent) {
		// snackbar.open(e.detail.text);
		let base64 = e.detail.text as string;
		// console.log('got le data', base64);
		let decodedData = await decode(base64);
		console.log('DECODED FROM QR CODE!!');
		
		snackbar.open(`Found: ${decodedData.label}`);
		switch(decodedData.type) {
			case 'sched':
				let matchscouting = decodedData.data as MatchScoutingLocal[];
				// await db.matchscouting.where({
				// 	org_key,
				// 	event_key
				// }).delete();
				// await db.matchscouting.bulkAdd(matchscouting);
				console.log(matchscouting);
				let result = await db.matchscouting.bulkPut(matchscouting);
				console.log(result);
				break;
			case 'meta':
				let org = decodedData.data.org as str<Org>;
				let users = decodedData.data.users as LightUser[];
				let teams = decodedData.data.teams as TeamLocal[];
				await db.orgs.put(org);
				await db.lightusers.bulkPut(users);
				await db.teams.bulkPut(teams);
				break;
		}
	}
</script>

<QrCodeScanner on:data={onQrCodeData} enabled={qrcodeEnabled} />

<SimpleSnackbar bind:this={snackbar} />
