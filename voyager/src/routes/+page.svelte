<script lang="ts">
	import type { Team } from '@firstteam102/scoutradioz-types';
	import { fetchJSON } from '$lib/fetcher';
	import AwaitLoader from '$lib/AwaitLoader.svelte';
	import Paper, { Title, Subtitle } from '@smui/paper';
	
	const pTeams = fetchJSON<Team[]>('/api/teams');
	console.log(pTeams);
</script>

<div class="paper-container">
	<AwaitLoader dataToAwait={pTeams} let:data={teams}>
		
		{#each teams as team}
		<Paper>
			<Title>Team # {team.team_number}</Title>
			<Subtitle>{team.nickname}</Subtitle>
		</Paper>
		{/each}
	</AwaitLoader>
</div>

<style lang="scss">
	.paper-container {
		margin: 24px;
		& :global(.smui-paper) {
			margin-bottom: 24px;
		}
	}
</style>
