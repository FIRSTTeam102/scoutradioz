<script lang="ts">
	import type { PageData } from './$types';
	import { userId } from '$lib/stores';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import PitAssignmentList from './PitAssignmentList.svelte';

	export let data: PageData;

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'partner', icon: 'group', label: "Partner's" },
		{ id: 'all', icon: 'groups', label: 'All' }
	];

	const myAssignments = data.assignments.filter((asg) => asg.primary?.id === $userId);
	const partnersAssignments = data.assignments.filter(
		(asg) => asg.secondary?.id === $userId || asg.tertiary?.id === $userId
	);
	const allAssignments = data.assignments;

	let initialActiveIndex = myAssignments.length ? 0 : partnersAssignments.length ? 1 : 2;
</script>

<SlidingTabs {tabs} {initialActiveIndex}>
	<PitAssignmentList slot="1" assignments={myAssignments} />
	<PitAssignmentList slot="2" assignments={partnersAssignments} />
	<PitAssignmentList slot="3" assignments={allAssignments} />
</SlidingTabs>
