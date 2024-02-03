<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import assert from '$lib/assert';
	import db from '$lib/localDB';
	import OrgPicker from '$lib/login/OrgPicker.svelte';
	import { org, org_password } from '$lib/login/login-stores';
	import { getPageLayoutContexts, postJSON } from '$lib/utils';

	const { snackbar } = getPageLayoutContexts();
</script>

<section class="comfortable grid columns">
	<h1>Sign in</h1>
	<s1>Hi there! Nice to see you again.</s1>
	<div style="height: 200px; border: 1px solid gray; padding: 8px">
		<p>OAuth</p>
		<a href="/login/github">Sign in with GitHub</a>
	</div>
	<br />
	<s2><i>Haven't linked an account yet?</i></s2>
	<br />
	<OrgPicker
		on:proceed={(e) => {
			assert($org && $org_password, 'Org / org password not specified');

			postJSON('/login/pick-org', {
				org_key: $org.org_key,
				org_password: $org_password
			})
				.then(async (data) => {
					if (!data.user)
						return snackbar.error('Unknown error - route succeeded but user not passed back');
					// Replace user with the new logged-in default_user
					await db.transaction('rw', db.user, async () => {
						await db.user.clear();
						await db.user.put(data.user);
					});
					// invalidateAll();
					goto('/login/pick-user');
				})
				.catch((err) => {
					snackbar.error(String(err));
				});
		}}
	/>
</section>
