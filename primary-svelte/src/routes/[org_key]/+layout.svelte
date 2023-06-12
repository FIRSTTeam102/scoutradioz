<script lang="ts">
	import type { LayoutServerData } from "./$types";

	export let data: LayoutServerData;
</script>
<svelte:head>
	<base href={'/' + data.org.org_key + '/'}/>
</svelte:head>
<!-- JL note: due to reasons, this h3 is inside the main with padding instead of inside the headerlogo div. We should re-architect the header/layout at some point -->
<h3 style='position: relative; top: -8px; padding-bottom: 8px;'>{data.eventName}</h3>
<pre>
	{JSON.stringify(data.user)}
</pre>
<slot/>