<script lang="ts">
	import { goto } from '$app/navigation';
	import assert from '$lib/assert';
	import db from '$lib/localDB';
	import { addRefreshButtonFunctionality, getPageLayoutContexts, postJSON } from '$lib/utils';

	import Autocomplete from '@smui-extra/autocomplete';
	import Button, { Label as BLabel } from '@smui/button';
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';

	import { msg } from '$lib/i18n';
	import { liveQuery } from 'dexie';

	import { getLogger } from '$lib/logger';
	import type { Org } from 'scoutradioz-types';
	import { onMount } from 'svelte';

	import { LightOrgOperations } from '$lib/DBOperations';

	const logger = getLogger('login/OrgPicker');
	
	let org: Org|null = null;
	let org_password = '';

	const { snackbar, refreshButton, refreshButtonAnimation } = getPageLayoutContexts();
	addRefreshButtonFunctionality(async () => {
		await LightOrgOperations.download();
	})
	// Retrieve the orgs from the database
	$: orgs = liveQuery(async () => {
		let retVal = await db.lightorgs.toArray();

		return retVal.sort(function (a, b) {
			if (a.team_number && b.team_number) return a.team_number - b.team_number;
			else if (a.team_number) return 1;
			else if (b.team_number) return -1;
			else return 0;
		});
	});

	onMount(async () => {
		let needsSync = await LightOrgOperations.needsSync();

		if (needsSync) {
			if (!navigator.onLine) {
				// TODO: show a message to the user or wait for navigator.online event to download orgs
				return logger.warn(
					'Orgs are too old or have not been downloaded; cannot download new ones because we are offline'
				);
			}
			logger.info('Orgs are too old or have not been downloaded; downloading new ones');
			refreshButtonAnimation.autoplay(LightOrgOperations.download);
		}
	});

	const getOrgOptionLabel = (org: Org) => {
		if (!org) return '';
		if (org.team_numbers) return org.team_numbers.join(' & ') + ' - ' + org.nickname;
		if (org.team_number) return org.team_number + ' - ' + org.nickname;
		return org.nickname;
	};
</script>

<section class="comfortable grid columns">
	<h1>Sign in</h1>
	<s1>Hi there! Nice to see you again.</s1>
	<!-- <div style="height: 200px; border: 1px solid gray; padding: 8px">
		<p>OAuth</p>
		<a href="/login/github">Sign in with GitHub</a>
	</div> -->
	<br />
	<s2><i>Haven't linked an account yet?</i></s2>
	<br />
	<form action="#">
		<div class="md:flex flex-row space-y-2 md:space-y-0 md:space-x-2">
			<!-- TODO: custom search function to support org key search too -->
			<Autocomplete
				class="basis-5/12"
				textfield$variant="filled"
				textfield$style="width: 100%"
				style="width: 100%"
				options={$orgs}
				disabled={!$orgs}
				getOptionLabel={getOrgOptionLabel}
				bind:value={org}
				label={msg('Organization')}
			/>
			<div class="basis-5/12">
				<Textfield
					label={msg('user.orgpassword')}
					variant="filled"
					style="width: 100%"
					type="password"
					disabled={!org}
					bind:value={org_password}
				>
					<HelperText slot="helper">{msg('user.login.orgpasswordhelptext')}</HelperText>
				</Textfield>
			</div>
			<div class="basis-1/6 justify-self-center self-start">
				<Button
					class="btn-same-height-as-input"
					style="width: 100%; justify-self: center"
					variant="unelevated"
					disabled={!org || !org_password}
					on:click={() => {
						assert(org && org_password, 'Org / org password not specified');

						logger.debug('Sending request to /login/pick-org');
						postJSON('/login/pick-org', {
							org_key: org.org_key,
							org_password: org_password
						})
							.then(async (data) => {
								if (!data.user || !data.org)
									return snackbar.error('Unknown error - route succeeded but user not passed back');
								// Replace user with the new logged-in default_user
								await db.transaction('rw', db.user, db.orgs, async () => {
									// Replace the single "user" collection with the new user info returned
									await db.user.clear();
									await db.user.put(data.user);
									// and put the "full" org info into the orgs table, i.e. the one with org config and all that but without hashed password
									await db.orgs.put(data.org);
								});
								console.log('doing goto pick-user!');
								goto('/login/pick-user');
								console.log('post goto');
							})
							.catch((err) => {
								logger.error(err);
								snackbar.error(String(err));
							});
					}}
				>
					<BLabel>{msg('proceed')}</BLabel>
				</Button>
			</div>
		</div>
	</form>
</section>
