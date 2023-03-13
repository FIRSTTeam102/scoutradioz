<script lang='ts'>
	import { encodeMatchScouting, decodeMatchScouting } from "$lib/compression";
	import db from "$lib/localDB";
	import SimpleSnackbar from "$lib/SimpleSnackbar.svelte";
	import { event_key, org_key } from "$lib/stores";
	
	let snackbar: SimpleSnackbar;
	
	db.matchscouting
	.where({
		event_key: $event_key,
		org_key: $org_key,
	})
	.sortBy('time')
	// .limit(36)
	// .toArray()
	.then(async data => {
		let compressed = await encodeMatchScouting(data);
		let decoded = await decodeMatchScouting(compressed);
		
		console.log(data);
		console.log(decoded);
		
		// console.log(b64encode(LZMA.compress(str)));
		
		// let str1 = compress(data);
		// let str2 = JSON.stringify(data);
		// console.log(str1.length);
		// console.log(str2.length);
		// let str3 = lzw.encode(str1);
		// let str4 = lzw.encode(str2);
		// console.log(str3.length);
		// console.log(str4.length);
		// let lzma1 = LZMA.compress(str1);
		// // let str6 = LZMA.compress(str2);
		// let str5 = b64encode(lzma1);
		// console.log(str5 === b64encode(b64decode(str5)));
		// // console.log(str6);
	})
</script>

<h1>Debug stuff</h1>

<button on:click={async () => {
	await db.lightusers.clear();
	await db.lightmatches.clear();
	await db.events.clear();
	await db.layout.clear();
	await db.events.clear();
	await db.matchscouting.clear();
	await db.pitscouting.clear();
	await db.teams.clear();
	await db.orgs.clear();
	
	snackbar.open('Cleared database.');
}}>Wipe database</button>

<SimpleSnackbar bind:this={snackbar}/>