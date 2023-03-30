<script lang="ts">
	import type { PageData } from './$types';
	import Tab, { Icon as TIcon, Label as TLabel } from '@smui/tab';
	import TabBar from '@smui/tab-bar';
	import Card, {
		Content as CContent,
		Actions as CActions,
		ActionButtons as CActionButtons,
		ActionIcons as CActionIcons
	} from '@smui/card';
	import Button, { Label as BLabel, Icon as BIcon } from '@smui/button';
	import { userId } from '$lib/stores';
	import SlidingTabs from '$lib/SlidingTabs.svelte';
	import PitAssignmentList from './PitAssignmentList.svelte';

	export let data: PageData;

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'partner', icon: 'group', label: "Partner's" },
		{ id: 'all', icon: 'groups', label: 'All' }
	];
	let activeTab = tabs[0];
	let activeData = data.assignments;
	
	$: activeData = data.assignments.filter((asg) =>
		activeTab.id === 'mine'
			? asg.primary?.id === $userId
			: activeTab.id === 'partner'
			? asg.secondary?.id === $userId || asg.tertiary?.id === $userId
			: true
	);
	
	const myAssignments = data.assignments.filter((asg) => asg.primary?.id === $userId);
	const partnersAssignments = data.assignments.filter(
		(asg) => asg.secondary?.id === $userId || asg.tertiary?.id === $userId
	);
	const allAssignments = data.assignments;
</script>


<SlidingTabs tabs={tabs}>
	<PitAssignmentList slot='1' assignments={myAssignments} />
	<PitAssignmentList slot='2' assignments={partnersAssignments} />
	<PitAssignmentList slot='3' assignments={allAssignments} />
</SlidingTabs>

<!-- <h1>Pit scouting</h1>

<TabBar {tabs} let:tab bind:active={activeTab}>
	<Tab {tab}>
		<TIcon class="material-icons">{tab.icon}</TIcon>
		<TLabel>{tab.label}</TLabel>
	</Tab>
</TabBar>

<div class="cards">
	{#each activeData as asg}
		<Card>
			<CContent>
				<h3>Team {asg.team_key.replace('frc', '')}</h3>
				Assigned to: {[asg.primary?.name, asg.secondary?.name, asg.tertiary?.name].filter(Boolean).join(', ') || 'None'}
			</CContent>
			<CActions fullBleed>
				<Button href={`/scouting/pit/form?key=${asg.team_key}`}>
					<BLabel>Scout</BLabel>
					<i class="material-icons" aria-hidden="true">arrow_forward</i>
				</Button>
			</CActions>
		</Card>
	{/each}
</div>

<style lang="scss">
	@use '../../../lib/cards.scss' as cards;

	.cards {
		@include cards.container;
	}
</style> -->
