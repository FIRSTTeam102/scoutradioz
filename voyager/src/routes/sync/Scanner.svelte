<script lang='ts'>
	import Paper from '@smui/paper';
	import QrCodeScanner from '$lib/QrCodeScanner.svelte';
	
	let qrcodeEnabled = true;
	
	function onQrCodeData(e: CustomEvent) {
		console.log('Got the data!', e.detail.text);
	}
	
</script>

<Paper>
	This is the Scouter Sync page!
</Paper>

<QrCodeScanner on:data={onQrCodeData} enabled={qrcodeEnabled} />