<script lang="ts">
	import type { PageData } from './$types';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import PitAssignmentList from './PitAssignmentList.svelte';
	import { sha1 } from 'oslo/crypto';
	import { onMount } from 'svelte';
	import { encodeHex, encodeBase32 } from 'oslo/encoding';
	import { base32Hash } from '$lib/utils';
	import { msg } from '$lib/i18n';
	import SvelteMarkdown from 'svelte-markdown';

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

	// our own base 32: 
	onMount(async () => {
		let st = performance.now();
		const listToChecksum = allAssignments.map((asg) => {
			return {
				year: asg.year,
				event_key: asg.event_key,
				org_key: asg.org_key,
				team_key: asg.team_key,
				primary: asg.primary,
				secondary: asg.secondary,
				tertiary: asg.tertiary
			};
		});
	});
</script>

<section class="comfortable">
	<h2><SvelteMarkdown source={msg('scouting.pitScheduleChecksum', {checksum: data.checksum})}/></h2>
	<SlidingTabs {tabs} {initialActiveIndex}>
		<PitAssignmentList slot="1" assignments={myAssignments} />
		<PitAssignmentList slot="2" assignments={partnersAssignments} />
		<PitAssignmentList slot="3" assignments={allAssignments} />
	</SlidingTabs>
</section>
