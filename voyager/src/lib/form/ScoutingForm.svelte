<script lang="ts">
	import Checkbox from './Checkbox.svelte';
	import Counter from './Counter.svelte';
	import Slider from './Slider.svelte';
	import Multiselect from './Multiselect.svelte';
	import Textblock from './Textblock.svelte';

	// import type { AnyDict } from 'scoutradioz-types';
	import type { LayoutField } from '$lib/types';

	export let layout: LayoutField[];
	export let teamNumber: number;
	layout.map((item) => {
		if (item.label) item.label = item.label.replace(/\{\{team_number\}\}/g, String(teamNumber));
		return item;
	});
	export let formData: {
		[key: string]: unknown;
	} = {};
</script>

<div class="form">
	{#if layout.length === 0}
		<h3>Form layout not found</h3>
	{/if}
	{#each layout as field}
		{#if field.id && field.type === 'checkbox'}
			<Checkbox bind:checked={formData[field.id]} {field} />
		{:else if field.id && (field.type === 'counter' || field.type === 'badcounter' || field.type === 'counterallownegative')}
			<Counter
				bind:value={formData[field.id]}
				{field}
				isBad={field.type === 'badcounter'}
				allowNegative={field.type === 'counterallownegative'}
			/>
		{:else if field.id && (field.type === 'slider' || field.type === 'timeslider')}
			<Slider bind:value={formData[field.id]} {field} isTime={field.type === 'timeslider'} />
		{:else if field.id && field.type === 'multiselect'}
			<Multiselect bind:value={formData[field.id]} {field} />
		{:else if field.id && field.type === 'textblock'}
			<Textblock bind:value={formData[field.id]} {field} />
		{:else if field.type === 'h2'}
			<h2 id={field.id}>{field.label}</h2>
		{:else if field.type === 'h3'}
			<h3>{field.label}</h3>
		{:else if field.type === 'spacer'}
			<hr />
		{:else if field.type !== 'derived'}
			<p class="error">Unknown element</p>
		{/if}
	{/each}
</div>

<style lang="scss">
	.form {
		display: grid;
		grid-auto-flow: row;
		gap: 0.75em;
		justify-content: center;
		margin: 1em 0;
		h2,
		h3 {
			margin: 0;
			text-align: center;
		}
	}
	hr {
		width: 100%;
		border-color: rgba(255, 255, 255, 0.25);
	}
</style>
