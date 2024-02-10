<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import { msg } from '$lib/i18n';
	import Button, { Label as BLabel } from '@smui/button';
	import SvelteMarkdown from 'svelte-markdown';
	import type { PageData } from './$types';
	import MatchAssignmentList from './MatchAssignmentList.svelte';

	export let data: PageData;

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'all', icon: 'groups', label: 'All' }
	];

	$: initialActiveIndex = data.myMatches.length ? 0 : 1;
	
	// TODO title bar
	// let title = getContext('title') as Writable<string>;
	// title.set(msg('scouting.matchScheduleChecksum', {checksum: data.checksum}))
</script>

<section class="comfortable">
	<h2><SvelteMarkdown source={msg('scouting.matchScheduleChecksum', {checksum: data.checksum})} /></h2>
	<!-- JL: yes this is hacky as HECK but i only have a few minutes to throw this together -->
	<p>
		Current match number: {data.firstMatchNumber}
		<Button
			on:click={() => {
				let newMatchNumber = Math.max(data.firstMatchNumber - 1, 1);
				localStorage.setItem(`match_number_${$page.data.event_key}`, String(newMatchNumber));
				invalidateAll();
			}}
		>
			<BLabel>Decrease</BLabel>
		</Button>
		<Button
			on:click={async () => {
				let newMatchNumber = data.firstMatchNumber + 1;
				localStorage.setItem(`match_number_${$page.data.event_key}`, String(newMatchNumber));
				invalidateAll();
			}}
		>
			<BLabel>Increase</BLabel>
		</Button>
	</p>
	
	<SlidingTabs {tabs} {initialActiveIndex}>
		<MatchAssignmentList slot="1" matches={data.myMatches} firstMatchNumber={data.firstMatchNumber} />
		<MatchAssignmentList slot="2" matches={data.allMatches} firstMatchNumber={data.firstMatchNumber} />
	</SlidingTabs>
</section>
