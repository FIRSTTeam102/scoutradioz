<script lang="ts">
	import Autocomplete from '@smui-extra/autocomplete';
	import Button, { Label as BLabel } from '@smui/button';

	import db, { type LightUser } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import { getLogger } from '$lib/logger';
	import { addRefreshButtonFunctionality, getPageLayoutContexts, setPageTitle } from '$lib/utils';

	import { goto, invalidateAll } from '$app/navigation';
	import { LightUserOperations } from '$lib/DBOperations';
	import { msg } from '$lib/i18n';
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;
	setPageTitle(
		msg('user.loginOrg', { org: data.org.nickname }),
		msg('user.login.currentlyAt', { event: data.event?.name || data.event_key || 'unknown' })
	);
	let user: LightUser | null = null;
	let userPicker: Autocomplete;

	// Retrieve the orgs from the database
	$: users = liveQuery(async () => {
		return await db.lightusers
			.where({
				org_key: data.org_key
			})
			.sortBy('name');
	});

	const logger = getLogger('login (user)');

	const { snackbar, refreshButton, refreshButtonAnimation } = getPageLayoutContexts();

	addRefreshButtonFunctionality(() => LightUserOperations.download(data.org_key).catch(snackbar.error));

	async function downloadUsers(showSnackbarWhenDone?: boolean) {
		try {
			logger.debug('Successfully saved users and saved syncstatus to database');
			if (showSnackbarWhenDone) {
				snackbar.open('Updated list of users from the remote database.');
			}
		} catch (err) {
			logger.error(err);
		}
	}

	async function updateUser(user: LightUser | null) {
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

	onMount(async () => {
		userPicker.focus();

		if (!data.org_key) {
			logger.warn('No org selected; redirecting to /');
			goto('/');
			return;
		}

		let needsSync = await LightUserOperations.needsSync(data.org_key);
		if (needsSync) {
			if (!navigator.onLine) {
				//  TODO show a message to the user or wait for navigator.online event to download users
				return logger.warn(
					'Users are too old or have not been downloaded; cannot download new ones because we are offline'
				);
			}
			logger.info('Users are too old or have not been downloaded; downloading new ones');
			refreshButtonAnimation.autoplay(() => LightUserOperations.download(data.org_key));
		}
	});

	const getUserOptionLabel = (user: LightUser) => {
		if (!user) return '';
		return user.name;
	};

	// todo: implement lol
	let needsPassword = false;
	let needsToCreatePassword = false;

	let password = '';
</script>

<section class="comfortable">
	<h1>Choose account for {data.org?.nickname}</h1>
	<!-- TODO: event nickname -->
	<s1>{data.org?.nickname} is currently at {data.org?.event_key}</s1>
	<br />
	<div class="md:flex flex-row space-y-2 md:space-y-0 md:space-x-2">
		<div class="basis-1/2 grow">
			<Autocomplete
				textfield$variant="filled"
				textfield$style="width: 100%"
				style="width: 100%"
				options={$users}
				disabled={!$users}
				getOptionLabel={getUserOptionLabel}
				bind:value={user}
				bind:this={userPicker}
				label={`Members of ${data.org?.nickname}`} />
		</div>
		<!-- WIP -->
		{#if needsPassword}
			<div class="basis-1/2 grow">
				<Textfield
					label={msg('user.login.personalpassword')}
					variant="filled"
					style="width: 100%"
					type="password"
					bind:value={password}>
					<HelperText slot="helper">{msg('user.login.orgpasswordhelptext')}</HelperText>
				</Textfield>
			</div>
		{/if}
		<div class="basis-1/2 grow justify-self-center self-start">
			<Button
				variant="unelevated"
				class="btn-same-height-as-input"
				style="width: 100%"
				disabled={!user}
				on:click={async () => {
					// Log in user
					await updateUser(user);
					goto(`/sync/lead#2`);
				}}>
				<BLabel>Done</BLabel>
			</Button>
		</div>
	</div>
</section>
