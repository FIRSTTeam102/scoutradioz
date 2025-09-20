<script lang="ts">
	import Textfield from '@smui/textfield';
	import type { NumberInputItem } from 'scoutradioz-types';

	interface Props {
		value?: any; // any because of weird casting to generic data
		field: NumberInputItem;
		onchange: () => void;
	}

	let { value = $bindable(''), field, onchange }: Props = $props();
</script>

<Textfield
	style="width: 100%;"
	helperLine$style="width: 100%;"
	type="number"
	bind:value
	label={field.label}
	onblur={onchange}
/>
<!-- JL note: textfield does not have an onchange event, but onblur seems to work well -->
