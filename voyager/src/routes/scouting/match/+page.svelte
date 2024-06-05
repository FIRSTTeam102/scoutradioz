<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { MatchScoutingOperations } from '$lib/DBOperations';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import { msg } from '$lib/i18n';
	import { addRefreshButtonFunctionality, getPageLayoutContexts, setPageTitle } from '$lib/utils';
	import Button, { Label as BLabel } from '@smui/button';
	import type { PageData } from './$types';
	import MatchAssignmentList from './MatchAssignmentList.svelte';

	export let data: PageData;
	setPageTitle(msg('scouting.match'), msg('scouting.scheduleVersion', {checksum: data.checksum}));

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'all', icon: 'groups', label: 'All' }
	];

	$: initialActiveIndex = data.myTeams.length ? 0 : 1;
	
	const { snackbar } = getPageLayoutContexts();
	addRefreshButtonFunctionality(async () => {
		const changed = await MatchScoutingOperations.download();
		if (changed) snackbar.open(msg('cloudsync.newDataDownloaded'), 4000);
		else snackbar.open(msg('cloudsync.upToDate'), 4000);
	})
</script>

<section class="comfortable">
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
		<MatchAssignmentList slot="1" matches={data.myTeams} firstMatchNumber={data.firstMatchNumber} />
		<MatchAssignmentList slot="2" matches={data.allMatches} firstMatchNumber={data.firstMatchNumber} />
	</SlidingTabs>
</section>
