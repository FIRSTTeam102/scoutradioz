<script lang="ts">
	import Select, { Option } from '@smui/select';
	import type { LayoutField } from '$lib/types';

	interface Props {
		value: any; // any because of weird casting to generic data
		field: LayoutField;
		onchange: () => void;
	}

	let { value = $bindable(), field, onchange }: Props = $props();
	// 2024-02-21 JL: Made field.options copy instead of mutate array to avoid multiple spaces being added before first real option
	let options = [...field.options as string[]]; 
	if (field.form_type !== 'matchscouting') options.unshift('');
	if (value === undefined) value = options[0];
</script>

<Select bind:value label={field.label} onSMUISelectChange={onchange}>
	{#each options as option}
		<Option value={option}>{option}</Option>
	{/each}
</Select>