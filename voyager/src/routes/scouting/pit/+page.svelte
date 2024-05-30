<script lang="ts">
	import { PitScoutingOperations } from '$lib/DBOperations';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import { msg } from '$lib/i18n';
	import { addRefreshButtonFunctionality, getPageLayoutContexts, setPageTitle } from '$lib/utils';
	import type { PageData } from './$types';
	import PitAssignmentList from './PitAssignmentList.svelte';

	export let data: PageData;

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'partner', icon: 'group', label: "Partner's" },
		{ id: 'all', icon: 'groups', label: 'All' }
	];

	const myAssignments = data.assignments.filter((asg) => asg.primary?.id === data.user._id);
	const partnersAssignments = data.assignments.filter(
		(asg) => asg.secondary?.id === data.user._id || asg.tertiary?.id === data.user._id
	);
	const allAssignments = data.assignments;

	let initialActiveIndex = myAssignments.length ? 0 : partnersAssignments.length ? 1 : 2;

	const { snackbar } = getPageLayoutContexts();

	setPageTitle(msg('scouting.pit'), msg('scouting.scheduleVersion', { checksum: data.checksum }));
	addRefreshButtonFunctionality(async () => {
		let changed = await PitScoutingOperations.download();
		// changed ||= await FormLayoutOperations.download('pit');
		if (changed) snackbar.open(msg('cloudsync.newDataDownloaded'), 4000);
		else snackbar.open(msg('cloudsync.upToDate'), 4000);
	}, msg('cloudsync.pitScheduleTooltip'));
</script>

<section class="comfortable">
	<SlidingTabs {tabs} {initialActiveIndex}>
		<PitAssignmentList slot="1" assignments={myAssignments} />
		<PitAssignmentList slot="2" assignments={partnersAssignments} />
		<PitAssignmentList slot="3" assignments={allAssignments} />
	</SlidingTabs>
</section>
