<script lang='ts'>
	import type { PageData } from "./$types";

	export let data: PageData;

</script>
<h1>Home</h1>
<p>Welcome to Scoutradioz Voyager</p>
{#if data.event}
	<p>You are currently at {data.event.name}</p>
{/if}