<script lang="ts">
	import Scanner from '../Scanner.svelte';
	import LeadSyncMothership from '../LeadSyncMothership.svelte';
	import { setPageTitle } from '$lib/utils';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import LeadQrCode from '../LeadQRCode.svelte';
	
	setPageTitle('Scouting lead sync')
	
	const tabs = [
		{label: 'Scan', id: 'scanner'},
		{label: 'Show QR', id: 'qr'},
		{label: 'Server', id: 'server'},
	];
	
</script>

<SlidingTabs {tabs}>
	<Scanner slot='1'/>
	<LeadQrCode slot='2'/>
	<LeadSyncMothership slot='3'/>
</SlidingTabs>
