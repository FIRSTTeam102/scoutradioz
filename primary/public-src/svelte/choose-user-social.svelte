<script lang="ts">
	import Button from '@smui/button';
	import Dialog, {
		Title as DTitle,
		Content as DContent,
		Actions as DActions,
	} from '@smui/dialog';
	import Paper from '@smui/paper';
	import type { User } from 'scoutradioz-types';
	let { data } = $props();

	let users = $state(data.users) as User[];
</script>

<div class="w3-auto">
	<h1>Choose a user</h1>
	{#each users as u (u._id)}
		<div class="w3-grid w3-margin-top" style="grid: auto / 1fr; gap: 1em">
			<Button variant="unelevated" href={"/user/social/login/choose?user_id=" + u._id}
				>{u.org_key + ' - ' + u.name}</Button
			>
		</div>
	{/each}
</div>
