<script lang="ts">
	import { goto } from "$app/navigation";
	import { msg } from "$lib/i18n";
	import OrgPicker from "$lib/login/OrgPicker.svelte";
	import type { PageServerData } from "./$types";
	
	export let data: PageServerData;

</script>

<section class="comfortable grid columns">
	<h1>{msg('user.login.title')}</h1>
	<s1>{msg('user.login.linkOAuthToOrg')}</s1>
	<br />
	<!-- TODO: custom search function to support org key search too -->
	<OrgPicker on:proceed={(e) => {goto(`/login?org_key=${e.detail.org_key}`)}} />
	
</section>