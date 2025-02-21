<script lang="ts">
	import type { SchemaItem } from 'scoutradioz-types';
	import Checkbox from './Checkbox.svelte';
	import Counter from './Counter.svelte';
	import Multiselect from './Multiselect.svelte';
	import type { FormData } from './ScoutingFormUtils';
	import Slider from './Slider.svelte';
	import Textblock from './Textblock.svelte';
	import Image from './Image.svelte';
	
	interface Props {
		layout: SchemaItem[];
		teamNumber: number;
		formData: FormData;
		onchange: () => void;
	};

	let { layout, teamNumber, formData = $bindable(), onchange }: Props = $props();
	
	// layout.map((item) => {
	// 	if (item.label) item.label = item.label.replace(/\{\{team_number\}\}/g, String(teamNumber));
	// 	return item;
	// });
</script>

<div class="form">
	{#if layout.length === 0}
		<h3>Form layout not found</h3>
	{/if}
	{#each layout as field}
		{#if field.type === 'checkbox'}
			<Checkbox
				bind:checked={formData[field.id]}
				{field}
				{onchange}
			/>
		{:else if field.type === 'counter'}
			<Counter
				bind:value={formData[field.id]}
				{field}
				{onchange}
				isBad={field.variant === 'bad'}
				allow_negative={field.allow_negative}
			/>
		{:else if field.type === 'slider'}
			<Slider
				bind:value={formData[field.id]}
				{field}
				{onchange}
			/>
		{:else if field.type === 'multiselect'}
			<Multiselect
				bind:value={formData[field.id]}
				{field}
				{onchange}
			/>
		{:else if field.type === 'textblock'}
			<Textblock
				bind:value={formData[field.id]}
				{field}
				{onchange}
			/>
		{:else if field.type === 'image'}
			<Image
				{field}
			/>
		{:else if field.type === 'header'}
			<h2 id={`header_${field.label}`}>{field.label}</h2>
		{:else if field.type === 'subheader'}
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
	:global(body) {
		overflow-x: hidden; // JL: if this is not true then sometimes headers that are too wide will mess with page width
	}
</style>
