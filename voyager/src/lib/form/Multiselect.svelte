<script lang="ts">
	import Select, { Option } from '@smui/select';
	import type { LayoutField } from '$lib/types';
	import { createEventDispatcher } from 'svelte';

	export let value: any; // any because of weird casting to generic data
	export let field: LayoutField;
	// 2024-02-21 JL: Made field.options copy instead of mutate array to avoid multiple spaces being added before first real option
	let options = [...field.options as string[]]; 
	if (field.form_type !== 'matchscouting') options.unshift('');
	if (value === undefined) value = options[0];
	export let isDefaultValue: boolean;
	$: isDefaultValue = (value === options[0]);
	
	const dispatch = createEventDispatcher();
	function dispatchChange() {
		dispatch('change');
	}
</script>

<Select bind:value label={field.label} on:MDCSelect:change={dispatchChange}>
	{#each options as option}
		<Option value={option}>{option}</Option>
	{/each}
</Select>