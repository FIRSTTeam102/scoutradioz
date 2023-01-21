<script lang="ts">
	import type { PageServerData } from './$types';
	import Paper, { Title, Subtitle, Content } from '@smui/paper';

	export let data: PageServerData;
</script>

<div class="paper-container">
	{#each data.teams as team}
		<Paper>
			<Title>{team.team_number}</Title>
			<Subtitle>{team.nickname}</Subtitle>
		</Paper>
	{/each}
</div>

<style lang="scss">
	.paper-container {
		margin: 24px;
		& :global(.smui-paper) {
			margin-bottom: 24px;
		}
	}
</style>
