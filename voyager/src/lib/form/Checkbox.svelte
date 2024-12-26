<script lang="ts">
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';
	import type { LayoutField } from '$lib/types';
	import { createEventDispatcher } from 'svelte';

	interface Props {
		checked?: any; // any because of weird casting to generic data
		field: LayoutField;
		onchange: () => void;
	}

	let { checked = $bindable(false), field, onchange }: Props = $props();
</script>

<FormField>
	<Checkbox bind:checked {onchange} />
	{#snippet label()}
		<span>{field.label}</span>
	{/snippet}
</FormField>
