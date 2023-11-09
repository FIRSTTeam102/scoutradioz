<script lang='ts'>
	import { event_name } from "$lib/stores";

</script>
<h1>Home</h1>
<p>Welcome to Scoutradioz Voyager</p>
{#if $event_name}
	<p>You are currently at {$event_name}</p>
{/if}