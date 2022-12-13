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
	import { user } from '$lib/stores';

	export let data: PageData;

	const tabs = [
		{ id: 'mine', icon: 'person', label: 'Assigned' },
		{ id: 'partner', icon: 'group', label: "Partner's" },
		{ id: 'all', icon: 'groups', label: 'All' }
	];
	let activeTab = tabs[0];
	let activeData = data.all;
	$: activeData = data.all.filter((asg) =>
		activeTab.id === 'mine'
			? asg.primary === $user
			: activeTab.id === 'partner'
			? asg.secondary === $user || asg.tertiary === $user
			: true
	);
</script>

<h1>Pit scouting</h1>

<TabBar {tabs} let:tab bind:active={activeTab}>
	<Tab {tab}>
		<TIcon class="material-icons">{tab.icon}</TIcon>
		<TLabel>{tab.label}</TLabel>
	</Tab>
</TabBar>

<div style="display: grid; gap: .5em; margin: .5em;">
	{#each activeData as asg}
		<Card>
			<CContent>
				<h3>Team {asg.team_key.replace('frc', '')}</h3>
				Assigned to: {[asg.primary, asg.secondary, asg.tertiary].filter(Boolean).join(', ')}
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
