<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';

	import db, { type TeamLocal, type LightMatch, type MatchScoutingLocal, type str, type WithStringDbId } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import type { Org } from 'scoutradioz-types';
	import { fetchJSON } from '$lib/utils';
	import { org_key } from '$lib/stores';

	import AwaitLoader from '$lib/AwaitLoader.svelte';
	import Paper, { Title, Subtitle } from '@smui/paper';

	// Retrieve the orgs from the database
	$: orgs = liveQuery(async () => {
		let retVal = await db.orgs.toArray();

		return retVal.sort(function(a, b){
				if (a.team_number && b.team_number)
					return a.team_number - b.team_number;
				else if (a.team_number)
					return 1;
				else if (b.team_number)
					return -1;
				else
					return 0;
			});
	});

	console.log(orgs);

	async function downloadOrgs() {
		try {
			const orgs = await fetchJSON<WithStringDbId<Org>[]>(
				`/api/orgs`
			);
			
			orgs.sort(function(a, b){
				if (a.team_number && b.team_number)
					return a.team_number - b.team_number;
				else if (a.team_number)
					return 1;
				else if (b.team_number)
					return -1;
				else
					return 0;
			});

			let result = await db.orgs.bulkPut(orgs);
			console.log(result);
		}
		catch (err) {
			console.log(err);
		}
	}
</script>

<div class="paper-container">
	<CActions>
		<Group variant="outlined">
			<Button variant="outlined" on:click={downloadOrgs}>
				<Icon class="material-icons">download</Icon>
				<BLabel>Download orgs</BLabel>
			</Button>
		</Group>
	</CActions>

	{#if $orgs}
		{#each $orgs as org}
		<Paper>
			<Title>{org.nickname}</Title>
			<Subtitle>Team # {org.team_number}</Subtitle>
			<Subtitle>{org.event_key}</Subtitle>
		</Paper>
		{/each}
	{/if}
</div>

<style lang="scss">
	.paper-container {
		margin: 24px;
		& :global(.smui-paper) {
			margin-bottom: 24px;
		}
	}
</style>
