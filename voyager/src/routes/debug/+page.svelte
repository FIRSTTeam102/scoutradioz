<script lang='ts'>
	import { encodeMatchScouting, decodeMatchScouting } from "$lib/compression";
	import db from "$lib/localDB";
	import SimpleSnackbar from "$lib/SimpleSnackbar.svelte";
	import { event_key, org_key } from "$lib/stores";
	
	let snackbar: SimpleSnackbar;
</script>

<h1>Debug stuff</h1>

<button on:click={async () => {
	await db.delete();
	
	snackbar.open('Cleared database.');
	
	setTimeout(() => {
		location.href = location.href; // reload page
	}, 1000);
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

<button on:click={async () => {
	let reason = await snackbar.open('Test', -1, 'Test');
	console.log(reason)
}}>
	Snackbar test
</button>

<SimpleSnackbar bind:this={snackbar}/>