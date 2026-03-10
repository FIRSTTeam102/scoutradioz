<script lang="ts">
	import Button from '@smui/button';
	import Autocomplete from '@smui-extra/autocomplete';
	import Paper from '@smui/paper';
	import type { Org, User } from 'scoutradioz-types';
	import Textfield from '@smui/textfield';
	import Icon from '@smui/textfield/icon';
	import HelperText from '@smui/textfield/helper-text';
	import Tooltip, { Wrapper } from '@smui/tooltip';
	import IconButton from '@smui/icon-button';
	let { data } = $props();
	import FullWidthInput from '../lib/FullWidthInput.svelte';

	let org_key = data.org_key as string;
	let title = data.title as string;
	let redirectURL = data.redirectURL as string;

	type UserIdName = { _id: string; name: string };
	let users: UserIdName[] | null = $state(null);
	let orgPassword = $state('');
	let userPassword = $state('');
	let newPassword1 = $state('');
	let newPassword2 = $state('');
	let pageState: 'orgpassword' | 'pickuser' = $state('orgpassword');
	let pickedUser: UserIdName | null = $state(null);
	let showUserPassword = $state(false); // log in w/ user password
	let showCreatePassword = $state(false); // create password
	let userPicker: Autocomplete;

	async function submitOrgPassword() {
		try {
			let res = await postJSON('/user/api/getusers', {
				org_password: orgPassword,
			});
			console.log(res);
			users = res;
			pageState = 'pickuser';
			requestAnimationFrame(() => { userPicker.focus(); }) // PJL: autofocus doesn't work
		} catch (err) {
			console.error(err);
			if (!(err instanceof Error)) return;
			NotificationCard.error(err.message);
		}
	}

	async function submitUser() {
		try {
			showUserPassword = false;
			showCreatePassword = false;
			let res = await postJSON('/user/api/pickuser', {
				org_password: orgPassword,
				user_id: pickedUser?._id
			});
			console.log(res);
			if (res.success === true) {
				let redirect = redirectURL || res.redirectURL;
				console.log('success; redirecting to ', redirect);
				location.href = redirect;
			}
			else if (res.create_password === true) {
				showCreatePassword = true;
			}
			else if (res.password_needed === true) {
				showUserPassword = true;
			}
			else {
				NotificationCard.error(`Unrecognized response: ${JSON.stringify(res)}`)
			}
		} catch (err) {
			console.error(err);
			if (!(err instanceof Error)) return;
			NotificationCard.error(err.message);
		}
	}
</script>

<div class="w3-auto">
	<h1>{title}</h1>
	{#if pageState === 'orgpassword'}
		<FullWidthInput
			bind:value={orgPassword}
			type="password"
			helper="Ask your org's lead for the password to log in."
			label="Organization password"
			submit="Next"
			onclick={submitOrgPassword}
		/>
	{:else if pageState === 'pickuser' && users}
		<div class="grid grid-cols-2">
			<Autocomplete
				bind:this={userPicker}
				textfield$variant="filled"
				textfield$style="width: 100%"
				style="width: 100%"
				options={users}
				getOptionLabel={(item) => (item ? item.name : '')}
				bind:value={pickedUser}
				label={'Find your username.'}
				onkeydown={(e) => {
					if (e.key === 'Enter') submitUser();
				}}
			/>
			<Button
				variant="unelevated"
				class="submit-button"
				disabled={!pickedUser}
				onclick={submitUser}
			>Log in
			</Button>
		</div>
		{#if showUserPassword}
		{/if}
	{/if}
	<hr />
			<h6>Please create a new password. <IconButton class='material-icons'>info</IconButton></h6>
</div>

<style>
	.input-field {
		display: grid;
		grid: auto / auto 100px;
		gap: 1em;
	}

	@media (max-width: 600px) {
		.input-field {
			grid: auto auto / auto;
		}
	}
	@media (min-width: 601px) {
		* :global(.submit-button) {
			height: 56px !important;
		}
	}
</style>
