<script lang='ts'>
	import { msg } from "./i18n";

	export let title: string;
	export let subtitle: string|boolean|undefined = undefined;
</script>

<h4 class='i'>{title}</h4>
{#if subtitle}
	<h6 class='i'>
		{#if subtitle === true}
			{msg('tryAgainLater')}
		{:else}
			{subtitle}
		{/if}
	</h6>
{/if}