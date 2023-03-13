<script lang='ts'>
	import Paper from '@smui/paper';
	import QrCodeScanner from '$lib/QrCodeScanner.svelte';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	
	let qrcodeEnabled = true;
	
	let snackbar: SimpleSnackbar;
	
	function onQrCodeData(e: CustomEvent) {
		snackbar.open(e.detail.text);
	}
	
</script>

<QrCodeScanner on:data={onQrCodeData} enabled={qrcodeEnabled} />

<SimpleSnackbar bind:this={snackbar}/>