<script lang="ts">
	import Textfield from '@smui/textfield';
	import type { LayoutField } from '$lib/types';

	interface Props {
		value?: any; // any because of weird casting to generic data
		field: LayoutField;
		onchange: () => void;
	}

	let { value = $bindable(''), field, onchange }: Props = $props();
</script>

<Textfield
	style="width: 100%;"
	helperLine$style="width: 100%;"
	textarea
	bind:value
	label={field.label}
	onblur={onchange}
/>
<!-- JL note: textfield does not have an onchange event, but onblur seems to work well -->
