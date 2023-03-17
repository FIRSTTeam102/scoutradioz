<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';

	import db, { type WithStringDbId } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import type { Org } from 'scoutradioz-types';
	import { fetchJSON } from '$lib/utils';

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

			let result = await db.orgs.bulkPut(orgs);
			console.log(result);
		}
		catch (err) {
			console.log(err);
		}
	}
</script>

<div class="grid columns" style="gap:1em">
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
		<Card>
			<Content>
				<h1 class="mdc-typography--headline5">{org.nickname}</h1>
				<p class="mdc-typography--body1">
					Team # {org.team_number} is at {org.event_key}
				</p>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button variant="outlined" href={`/login?org_key=${org.org_key}`}>
						<Icon class="material-icons">key</Icon>
						<BLabel>Login</BLabel>
					</Button>
				</Group>
			</CActions>
		</Card>
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
