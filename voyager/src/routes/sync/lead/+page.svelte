<script lang="ts">
	import Scanner from '../Scanner.svelte';
	import LeadQRCode from '../LeadQRCode.svelte';
	import LeadSyncMothership from '../LeadSyncMothership.svelte';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	
</script>

<SlidingTabs tabs={[
	{label: 'Scan', component: Scanner},
	{label: 'Show QR', component: LeadQRCode},
	{label: 'Server', component: LeadSyncMothership},
]}
/>