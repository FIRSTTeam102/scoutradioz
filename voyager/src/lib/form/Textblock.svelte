<script lang="ts">
	import Textfield from '@smui/textfield';
	import type { LayoutField } from '$lib/types';

	export let value: any = ''; // any because of weird casting to generic data
	export let field: LayoutField;
</script>

<Textfield
	style="width: 100%;"
	helperLine$style="width: 100%;"
	textarea
	bind:value
	label={field.label}
/>
