<script lang='ts'>
	import Paper from '@smui/paper';
	import QrCodeScanner from '$lib/QrCodeScanner.svelte';
	
	let qrcodeEnabled = true;
	
	function onQrCodeData(e: CustomEvent) {
		console.log('Got the data!', e.detail.text);
	}
	
</script>

<QrCodeScanner on:data={onQrCodeData} enabled={qrcodeEnabled} />