<script lang="ts">
	import Button, { Group, Label as BLabel, Icon } from '@smui/button';
	import Card, { Actions as CActions, Content } from '@smui/card';
	import Autocomplete from '@smui-extra/autocomplete';
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';

	import db, { type WithStringDbId } from '$lib/localDB';
	import { liveQuery } from 'dexie';

	import type { Org } from 'scoutradioz-types';
	import { fetchJSON } from '$lib/utils';
	import { getContext, onDestroy, onMount } from 'svelte';
	import { getLogger } from '$lib/logger';

	import { org, org_password } from './login-stores';
	import { goto } from '$app/navigation';
	import type { RefreshButtonAnimationContext, RefreshContext, SnackbarContext } from '$lib/types';

	const logger = getLogger('login (root)');

	const refreshButton = getContext('refreshButton') as RefreshContext;
	const refreshButtonAnimation = getContext('refreshButtonAnimation') as RefreshButtonAnimationContext;
	const snackbar = getContext('snackbar') as SnackbarContext;

	// Retrieve the orgs from the database
	$: orgs = liveQuery(async () => {
		let retVal = await db.orgs.toArray();

		return retVal.sort(function (a, b) {
			if (a.team_number && b.team_number) return a.team_number - b.team_number;
			else if (a.team_number) return 1;
			else if (b.team_number) return -1;
			else return 0;
		});
	});

	async function downloadOrgs(showSnackbarWhenDone?: boolean) {
		try {
			const orgs = await fetchJSON<WithStringDbId<Org>[]>(`/api/orgs`);
			logger.debug(`Fetched ${orgs.length} orgs`);

			await db.orgs.clear();
			logger.info('Cleared orgs db');

			await db.orgs.bulkPut(orgs);
			await db.syncstatus.put({
				table: 'orgs',
				filter: '',
				time: new Date()
			});
			logger.debug('Successfully saved orgs and saved syncstatus to database');
			if (showSnackbarWhenDone) {
				snackbar.open('Updated list of organizations from the remote database.');
			}
		} catch (err) {
			logger.error(err);
			snackbar.error('Failed to fetch orgs from the database. Did you go offline?');
		}
	}

	const ORG_SYNC_TOO_OLD = 1000 * 3600 * 24 * 7; // 1 week

	onMount(async () => {
		refreshButton.set({
			supported: true,
			tooltip: 'Refresh list of orgs',
			onClick: async () => {
				await downloadOrgs(true);
			}
		});

		let orgSyncStatus = await db.syncstatus
			.where({
				table: 'orgs',
				filter: ''
			})
			.first();

		if (!orgSyncStatus || orgSyncStatus.time.valueOf() < Date.now() - ORG_SYNC_TOO_OLD) {
			if (!navigator.onLine) {
				// TODO: show a message to the user or wait for navigator.online event to download orgs
				return logger.warn(
					'Orgs are too old or have not been downloaded; cannot download new ones because we are offline'
				);
			}
			logger.info('Orgs are too old or have not been downloaded; downloading new ones');
			refreshButtonAnimation.autoplay(downloadOrgs);
		}
	});

	onDestroy(() => {
		refreshButton.set({
			supported: false,
		})
	})

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
	<div style="height: 200px; border: 1px solid gray; padding: 8px;">OAuth will go here</div>
	<br />
	<s2><i>Haven't linked an account yet?</i></s2>
	<br />
	<!-- TODO: custom search function to support org key search too -->
	<div class="md:flex flex-row space-y-2 md:space-y-0 md:space-x-2">
		<Autocomplete
			class="basis-5/12"
			textfield$variant="filled"
			textfield$style="width: 100%"
			style="width: 100%"
			options={$orgs}
			disabled={!$orgs}
			getOptionLabel={getOrgOptionLabel}
			bind:value={$org}
			label="Organization"
		/>
		<div class="basis-5/12">
			<Textfield
				label="Organization Password"
				variant="filled"
				style="width: 100%"
				type="password"
				disabled={!$org}
				bind:value={$org_password}
			>
				<HelperText slot="helper">Password set by your organization in order to log in</HelperText>
			</Textfield>
		</div>
		<div class="basis-1/6 justify-self-center self-center">
			<Button
				class=""
				style='width: 100%; justify-self: center'
				variant="unelevated"
				disabled={!$org || !$org_password}
				on:click={() => goto(`/login?org_key=${$org?.org_key}`)}
			>
				<BLabel>Proceed</BLabel>
			</Button>
		</div>
	</div>
</section>