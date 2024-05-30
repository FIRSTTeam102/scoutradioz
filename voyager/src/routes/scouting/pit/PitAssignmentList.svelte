<script lang="ts">
	import Card, {
		Content as CContent,
		Actions as CActions,
		ActionButtons as CActionButtons,
		ActionIcons as CActionIcons
	} from '@smui/card';
	import Button, { Label as BLabel, Icon as BIcon } from '@smui/button';
	import { onMount } from 'svelte';
	import type { PitScoutingLocal } from '$lib/localDB';

	export let assignments: PitScoutingLocal[];
</script>

<div class="cards">
	{#if assignments.length}
		{#each assignments as asg}
			<Card>
				<CContent>
					<h3>Team {asg.team_key.replace('frc', '')}</h3>
					Assigned to: {[asg.primary?.name, asg.secondary?.name, asg.tertiary?.name]
						.filter(Boolean)
						.join(', ') || 'None'}
				</CContent>
				<CActions fullBleed>
					<Button href={`/scouting/pit/form?key=${asg.team_key}`}>
						<BLabel>
							Scout
							<!-- TODO: make better and more clear, e.g. with colors -->
							{#if asg.completed && asg.synced}
								(Complete)
							{:else if asg.completed && !asg.synced}
								(Complete but not synced)
							{/if}
						</BLabel>
						<i class="material-icons" aria-hidden="true">arrow_forward</i>
					</Button>
				</CActions>
			</Card>
		{/each}
	{:else}
		<p>No assignments found.</p>
	{/if}
</div>

<style lang="scss">
	@use '../../../lib/cards.scss' as cards;

	.cards {
		@include cards.container;
	}
</style>

