<script lang="ts">
	import Scanner from '../Scanner.svelte';
	import LeadSyncMothership from '../LeadSyncMothership.svelte';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import ScouterQrCode from '../ScouterQRCode.svelte';
	
	const tabs = [
		{label: 'Scan', id: 'scanner'},
		{label: 'Show QR', id: 'qr'},
	];
	
</script>

<SlidingTabs {tabs}>
	<Scanner slot='1'/>
	<ScouterQrCode slot='2'/>
</SlidingTabs>