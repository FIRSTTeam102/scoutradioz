<script lang="ts">
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';
	import type { LayoutField } from '$lib/types';

	export let checked: any = false; // any because of weird casting to generic data
	export let field: LayoutField;
</script>

<FormField>
	<Checkbox bind:checked />
	<span slot="label">{field.label}</span>
</FormField>
