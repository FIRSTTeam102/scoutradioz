<script lang="ts">
	import { page } from '$app/stores';

	console.log($page);
</script>

<div style="text-align: center">
	<h1>{$page.error?.message}</h1>
	{#if $page.error?.name}
		<h3>{$page.status} - {$page.error?.name}</h3>
	{:else}
		<h3>{$page.status}</h3>
	{/if}
</div>
{#if $page.status !== 404}
	<p>To help us fix this error, please:</p>
	<ol>
		<li>Take a screenshot of this error message,</li>
		<li>Copy the full URL of this page by clicking on "Share" at the top of the page,</li>
		<li>Post the screenshot in either our Discord server or our <a href="https://github.com/FIRSTTeam102/scoutradioz/issues" target="_blank" rel="noreferrer">GitHub page</a>, including relevant information, such as the link you clicked to get to this error.</li>
	</ol>

	{#if $page.error?.stack}
		<pre style="overflow-x: auto; opacity: 0.75;">{$page.error?.stack}</pre>
	{/if}
{/if}