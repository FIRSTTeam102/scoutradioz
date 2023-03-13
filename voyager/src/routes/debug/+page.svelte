<script lang='ts'>
	import { encodeMatchScouting, decodeMatchScouting } from "$lib/compression";
	import db from "$lib/localDB";
	import SimpleSnackbar from "$lib/SimpleSnackbar.svelte";
	import { event_key, org_key } from "$lib/stores";
	
	let snackbar: SimpleSnackbar;
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
}}>Wipe local database</button>

<button on:click={async () => {
	let response = await fetch('/debug/flush_cache');
	if (response.ok) {
		snackbar.open('Flushed server DB cache.');
	}
	else {
		snackbar.error('Something went wrong')
	}
}}>Flush server database cache</button>

<SimpleSnackbar bind:this={snackbar}/>