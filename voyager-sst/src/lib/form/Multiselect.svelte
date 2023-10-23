<script lang="ts">
	import Select, { Option } from '@smui/select';
	import type { LayoutField } from '$lib/types';

	export let value: any; // any because of weird casting to generic data
	export let field: LayoutField;
	let options = field.options as string[];
	if (field.form_type !== 'matchscouting') options.unshift('');
	if (value === undefined) value = options[0];
</script>

<Select bind:value label={field.label}>
	{#each options as option}
		<Option value={option}>{option}</Option>
	{/each}
</Select>
