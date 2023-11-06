<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';

	import db, { type LightUser, type WithStringDbId } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import type { User } from 'scoutradioz-types';
	import { fetchJSON } from '$lib/utils';

	import type { PageData } from './$types';

	export let data: PageData;

	// Retrieve the orgs from the database
	$: users = liveQuery(async () => {
		return await db.lightusers
            .where({
				org_key: data.org_key
			})
            .sortBy("name");
	});

	console.log(users);

	async function downloadUsers() {
		try {
			const users = await fetchJSON<WithStringDbId<User>[]>(
				`/api/orgs/${data.org_key}/users`
			);

			let result = await db.lightusers.bulkPut(users);
			console.log(result);
		}
		catch (err) {
			console.log(err);
		}
	}

    async function updateUser(user: LightUser) {
        try {
            db.user.clear();

			let result = await db.user.put(user);
			console.log(`Result of db.user.put(user) = ${result}`);
        }
		catch (err) {
			console.log(err);
		}
    }
</script>

<div class="grid columns" style="gap:1em">
	<CActions>
		<Group variant="outlined">
			<Button variant="outlined" on:click={downloadUsers}>
				<Icon class="material-icons">download</Icon>
				<BLabel>Download users</BLabel>
			</Button>
		</Group>
	</CActions>

	{#if $users}
		{#each $users as user}
		<Card>
			<Content>
				<h5>{user.name}</h5>
			</Content>
			<CActions>
				<Group variant="outlined">
					<Button variant="outlined" on:click={() => {
                        updateUser(user);
                    }}>
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
