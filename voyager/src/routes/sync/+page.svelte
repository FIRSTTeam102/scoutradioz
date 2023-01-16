<script lang="ts">
	import ScouterSync from './ScouterSync.svelte';
	import LeadSync from './LeadSync.svelte';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	
</script>

<SlidingTabs tabs={[
	{label: 'Scouter', component: ScouterSync},
	{label: 'Scouting lead', component: LeadSync}
]}
/>