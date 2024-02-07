<script lang="ts">
	import { goto } from "$app/navigation";
	import { msg } from "$lib/i18n";
	import type { PageServerData } from "./$types";
	
	export let data: PageServerData;

</script>

<section class="comfortable grid columns">
	<h1>{msg('user.login.title')}</h1>
	<s1>{msg('user.login.linkOAuthToOrg')}</s1>
	<br />
</section>