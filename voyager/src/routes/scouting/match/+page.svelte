<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import { msg } from '$lib/i18n';
	import Button, { Label as BLabel } from '@smui/button';
	import type { PageData } from './$types';
	import MatchAssignmentList from './MatchAssignmentList.svelte';
	import Paper, { Content } from '@smui/paper';

	export let data: PageData;

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'all', icon: 'groups', label: 'All' }
	];

	console.log(data.grouped, data.user);

	const myMatches = data.grouped.filter((match) =>
		match.some((asg) => asg.assigned_scorer?.id === data.user._id)
	);
	const allMatches = data.grouped;

	let initialActiveIndex = myMatches.length ? 0 : 1;
</script>

<h2>{msg('scouting.match')}</h2>
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
		on:click={() => {
			let newMatchNumber = data.firstMatchNumber + 1;
			localStorage.setItem(`match_number_${$page.data.event_key}`, String(newMatchNumber));
			invalidateAll();
		}}
	>
		<BLabel>Increase</BLabel>
	</Button>
</p>

<SlidingTabs {tabs} {initialActiveIndex}>
	<MatchAssignmentList slot="1" matches={myMatches} firstMatchNumber={data.firstMatchNumber} />
	<MatchAssignmentList slot="2" matches={allMatches} firstMatchNumber={data.firstMatchNumber} />
</SlidingTabs>
