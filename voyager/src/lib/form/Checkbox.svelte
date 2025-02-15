<script lang="ts">
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';
	import type { CheckBoxItem } from 'scoutradioz-types';

	interface Props {
		checked?: any; // any because of weird casting to generic data
		field: CheckBoxItem;
		onchange: () => void;
	}

	let { checked: checkedNumber = $bindable(0), field, onchange: onchangeProp }: Props = $props();

	// JL note: SMUI Checkbox requires 'checked' attribute to be boolean, but we store checkboxes as numbers.
	// 	It's simplest to translate on the fly between boolean and number inside here.
	let checked = $state(!!checkedNumber);
	function onchange() {
		checkedNumber = checked ? 1 : 0;
		onchangeProp();
	}
</script>

<FormField>
	<Checkbox bind:checked {onchange} />
	{#snippet label()}
		<span>{field.label}</span>
	{/snippet}
</FormField>
