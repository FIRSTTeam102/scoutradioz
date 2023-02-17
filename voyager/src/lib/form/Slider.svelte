<script lang="ts">
	import Slider from '@smui/slider';
	import type { LayoutField } from '$lib/types';
	import type { FormSliderOptions } from 'scoutradioz-types';

	export let value: any = 0; // any because of weird casting to generic data
	export let isTime = false;
	export let field: LayoutField;
	let options = field.options as FormSliderOptions;
	value = options.min;

	const reversed = options.step < 0;
</script>

<div>
{#if options}
<p>{field.label}</p>
<div dir={reversed ? 'rtl' : 'ltr'}>
<Slider
	bind:value
	min={options.min}
	max={options.max}
	step={Math.abs(options.step)}
	discrete
/>
</div>
<div class="below" class:reversed>
	<span class="grey">{options.min}</span>
	<span>
		{#if isTime}
			{Math.floor(value / 60)}:{String(value % 60).padStart(2, '0')}<br><small class="grey">{value} s</small>
		{:else}
			{value}
		{/if}
	</span>
	<span class="grey">{options.max}</span>
</div>
{:else}
<p class="error">Missing slider options</p>
{/if}
</div>

<style lang="scss">
	@use '@material/theme/color-palette';
	.below {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		justify-content: space-between; // todo: make sure perfectly centered
		text-align: center;
		margin: 0 1em;
		&.reversed {
			flex-direction: row-reverse;
		}
	}
	.grey {
		color: color-palette.$grey-600;
	}
	p {
		margin: 0;
	}
</style>