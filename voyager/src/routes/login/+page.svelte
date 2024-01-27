<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';
	import Autocomplete from '@smui-extra/autocomplete';
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';

	import db, { type LightUser, type WithStringDbId } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import type { User } from 'scoutradioz-types';
	import { fetchJSON } from '$lib/utils';
	import { getLogger } from '$lib/logger';

	import { org, org_password, user } from '../login-stores';

	import type { PageData } from './$types';
	import { getContext, onDestroy, onMount } from 'svelte';
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import type { RefreshButtonAnimationContext, RefreshContext, SnackbarContext } from '$lib/types';

	export let data: PageData;

	// Retrieve the orgs from the database
	$: users = liveQuery(async () => {
		return await db.lightusers
			.where({
				org_key: data.org_key
			})
			.sortBy('name');
	});

	const logger = getLogger('login (user)');
	const snackbar = getContext('snackbar') as SnackbarContext;
	const refreshButton = getContext('refreshButton') as RefreshContext;
	const refreshButtonAnimation = getContext('refreshButtonAnimation') as RefreshButtonAnimationContext;
	
	async function downloadUsers(showSnackbarWhenDone?: boolean) {
		try {
			if (!$org) throw new Error('No org selected');
			const users = await fetchJSON<WithStringDbId<User>[]>(`/api/orgs/${data.org_key}/users`);
			logger.debug(`Fetched ${users.length} users`);

			// Delete existing users that match this org key
			let deletedUsers = await db.lightusers
				.where({
					org_key: $org.org_key
				})
				.delete();
			logger.info(`Deleted ${deletedUsers} users from database`);

			await db.lightusers.bulkPut(users);
			await db.syncstatus.put({
				table: 'lightusers',
				filter: `org=${$org.org_key}`,
				time: new Date()
			});
			logger.debug('Successfully saved users and saved syncstatus to database');
			if (showSnackbarWhenDone) {
				snackbar.open('Updated list of users from the remote database.');
			}
		} catch (err) {
			logger.error(err);
		}
	}

	async function updateUser(user: LightUser|null) {
		if (!user) return logger.error('updateUser called with user not defined');
		try {
			logger.debug('Clearing user');
			db.user.clear();

			let result = await db.user.put(user);
			logger.debug(`Result of db.user.put(user) = ${result}`);
			// After the user is set in the db, invalidate all page loads so that org/etc. info are all reloaded from Dexie
			invalidateAll();
		} catch (err) {
			logger.error(err);
		}
	}

	const USER_SYNC_TOO_OLD = 1000 * 3600 * 24 * 7; // 1 week

	onMount(async () => {
		if (!$org) {
			logger.warn('No org selected; redirecting to /');
			goto('/');
			return;
		}
		
		refreshButton.set({
			supported: true,
			onClick: () => {
				downloadUsers(true);
			},
			tooltip: 'Refresh list of users'
		})
		
		let userSyncStatus = await db.syncstatus
			.where({
				table: 'lightusers',
				filter: `org=${$org.org_key}`
			})
			.first();

		if (!userSyncStatus || userSyncStatus.time.valueOf() < Date.now() - USER_SYNC_TOO_OLD) {
			if (!navigator.onLine) {
				//  TODO show a message to the user or wait for navigator.online event to download users
				return logger.warn(
					'Users are too old or have not been downloaded; cannot download new ones because we are offline'
				);
			}
			logger.info('Users are too old or have not been downloaded; downloading new ones');
			refreshButtonAnimation.autoplay(downloadUsers);
		}
	});
	
	onDestroy(() => {
		refreshButton.set({
			supported: false,
		});
	})
	
	const getUserOptionLabel = (user: LightUser) => {
		if (!user) return '';
		return user.name;
	}
</script>

<section class="comfortable">
	<h1>Choose account for {$org?.nickname}</h1>
	<!-- TODO: event nickname -->
	<s1>{$org?.nickname} is currently at {$org?.event_key}</s1>
	<br>
	<div class="md:flex flex-row sm:space-y-2 md:space-x-2">
		<div class="basis-1/2 grow">
			<Autocomplete
				textfield$variant="filled"
				textfield$style="width: 100%"
				style="width: 100%"
				options={$users}
				disabled={!$users}
				getOptionLabel={getUserOptionLabel}
				bind:value={$user}
				label={`Members of ${$org?.nickname}`}
			/>
		</div>
		<div class="basis-1/2 grow">
			<Button variant="unelevated" style="width: 100%" disabled={!$user} on:click={async () => {
				// Log in user
				await updateUser($user);
				goto(`/sync/lead#2`)
			}}>
				<BLabel>Done</BLabel>
			</Button>
		</div>
	</div>
</section>