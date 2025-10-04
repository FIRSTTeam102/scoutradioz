<script lang="ts">
	// import LayoutGrid, { Cell } from '@smui/layout-grid';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { msg } from '$lib/i18n/index';
	import type { MatchScoutingLocal } from '$lib/localDB';
	import Button, { Label as BLabel } from '@smui/button';
	import Card, { Content as CContent } from '@smui/card';
	import List, { Item, Meta, PrimaryText, SecondaryText, Text } from '@smui/list';

	export let firstMatchNumber: number;
	export let matches: MatchScoutingLocal[][];

	const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true
	});
	
</script>

<div class="match-scouting-cards">
	{#each matches as group}
		<Card>
			<CContent>
				<div class="head">
					<h3>Match {group[0].match_number}</h3>
					<span>{dateTimeFormat.format(group[0].time * 1000)}</span>
				</div>
				<List twoLine nonInteractive>
					{#each group as asg}
						<Item
							class={(asg.completed && asg.synced
								? 'complete-and-synced '
								: asg.completed && !asg.synced
								? 'complete-locally '
								: 'incomplete ') + asg.alliance}
							selected={asg.assigned_scorer?.id === $page.data.user_id}
						>
							<Text>
								<PrimaryText>Team {asg.team_key.replace('frc', '')}: {asg.team_name}</PrimaryText>
								<SecondaryText>Assigned to: {asg.assigned_scorer?.name}</SecondaryText>
							</Text>
							<Meta>
								<Button href={`/scouting/match/${asg.match_team_key}`}>
									<BLabel>Scout</BLabel>
									<i class="material-icons" aria-hidden="true">arrow_forward</i>
								</Button>
							</Meta>
						</Item>
					{/each}
				</List>
			</CContent>
		</Card>
	{/each}
</div>
