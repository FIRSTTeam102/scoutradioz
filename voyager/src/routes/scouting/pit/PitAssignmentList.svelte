<script lang='ts'>
	import Card, {
		Content as CContent,
		Actions as CActions,
		ActionButtons as CActionButtons,
		ActionIcons as CActionIcons
	} from '@smui/card';
	import Button, { Label as BLabel, Icon as BIcon } from '@smui/button';
	import type { PitScouting } from "scoutradioz-types";

	export let assignments: PitScouting[];
</script>

<div class="cards">
	{#each assignments as asg}
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
</style>