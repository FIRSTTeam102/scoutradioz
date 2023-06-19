<script lang="ts">
	import { msg } from '$lib/i18n';
	import { onMount } from 'svelte';
	import type { ActionData, PageData } from './$types';
	import { goto } from '$app/navigation';
	import type { User } from 'scoutradioz-types';
	import { HttpError, fetchJSON, isHttpError, postAndFetchJSON } from '$lib/fetcher';

	import { enhance, applyAction } from '$app/forms';
	export let data: PageData;
	export let form: ActionData;

	let formElem: HTMLFormElement;

	let orgPassword: string;
	let selectedUserId: string;

	// JL: should this be inside onMount?
	if (!data.org) {
		throw new Error('Org not found!!');
	}

	// async function getUserList() {
	// 	if (state !== 'org_password') return console.error('getUserList() abort because state is not org_password');
	// 	try {
	// 		userList = await postAndFetchJSON(`/api/orgs/${data.org.org_key}/list-users`, {
	// 			org_password: orgPassword,
	// 		});
	// 		console.log('getUserList', userList);
	// 		// If we successfully retrieved the user list, then change state
	// 		if (userList && Array.isArray(userList)) {
	// 			state = 'select_user';
	// 		}
	// 	}
	// 	catch (err) {
	// 		if (isHttpError(err)) {
	// 			console.error(err.body);
	// 		}
	// 	}
	// }
	
	// $: console.log(form);

	if (form?.org_password) {
		orgPassword = form.org_password;
	}
	if (form?.selected_user_id) {
		selectedUserId = form.selected_user_id;
	}
	
	$: console.log(`Selected user: ${selectedUserId}`);
	$: console.log(formElem)

	// async function selectUser() {
	// 	// if (state !== 'select_user') return console.error('selectUser() abort because state is not select_user');
	// 	// console.log(`Fetching details for user ${selectedUserId}`);

	// 	if (!form?.userList) {
	// 		return console.error('selectUser: userlist has not been defined');
	// 	}
	// 	let cachedAction = formElem.action;
	// 	formElem.action = 'user/login?/selectUser';
	// 	formElem.submit();
	// }

	// $: console.log(`Form has returned`, form);
</script>

<h3 class="theme-text">{msg('user.loginOrg', { org: data.org.nickname })}</h3>
<form action="user/login" method="POST" bind:this={formElem}>
	<!-- Section to enter org password -->
	<div class:hidden={!!form?.org_password_accepted}>
		<div class="w3-container w3-padding-16">
			<div class="w3-quarter w3-label theme-inline-padding">
				<label for="org_password">{msg('user.orgpassword')}</label>
			</div>
			<div class="w3-half">
				<input
					type="password"
					id="org_password"
					name="org_password"
					class="w3-input theme-input w3-no-border theme-inline-padding"
					bind:value={orgPassword}
				/>
			</div>
		</div>
		<div class="w3-padding-16">
			<button formaction="user/login?/listUsers" class="gear-btn theme-submit w3-btn"
				>{msg('user.next')}</button
			>
		</div>
	</div>
	<div class:hidden={!form?.org_password_accepted}>
		{#if form?.userList}
			<div class="w3-container w3-padding-16">
				<div class="w3-quarter w3-label theme-inline-padding">
					<label for="user_select">{msg('user.name')}</label>
				</div>
				<div class="w3-half">
					<select
						name="user_select"
						id="user_select"
						class="w3-select theme-input w3-no-border"
						bind:value={selectedUserId}
					>
						<option />
						{#each form.userList as user}
							<option value={user._id} class="w3-bar-item">{user.name}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
		{#if form?.create_password}
			<div class="w3-container w3-padding-16">
				<div class="w3-quarter w3-label theme-inline-padding">
					<label for="newPassword1">{msg('user.newpassword')}</label>
				</div>
				<div class="w3-half">
					<input
						type="password"
						name="newPassword1"
						id="newPassword1"
						class="w3-input theme-input w3-no-border theme-inline-padding"
					/>
				</div>
			</div>
			<div class="w3-container w3-padding-16">
				<div class="w3-quarter w3-label theme-inline-padding">
					<label for="newPassword2">{msg('user.newpassword')}</label>
				</div>
				<div class="w3-half">
					<input
						type="password"
						name="newPassword2"
						id="newPassword2"
						class="w3-input theme-input w3-no-border theme-inline-padding"
					/>
				</div>
			</div>
		{/if}
		{#if form?.password_needed}
			<div class="w3-container w3-padding-16">
				<div class="w3-quarter w3-label theme-inline-padding">
					<label for="personalPassword">{msg('user.personalPassword')}</label>
				</div>
				<div class="w3-half">
					<input
						type="password"
						name="personalPassword"
						id="personalPassword"
						class="w3-input theme-input w3-no-border theme-inline-padding"
					/>
				</div>
			</div>
		{/if}
		<div class="w3-padding-16">
			<input
				type="submit"
				class="gear-btn theme-submit w3-btn"
				value={msg('user.login')}
				formaction="user/login?/selectUser"
			/>
		</div>
	</div>
	<!-- {:else if state === 'select_user'} -->
	<!-- {/if} -->
</form>

<style>
	.hidden {
		display: none;
	}
</style>
