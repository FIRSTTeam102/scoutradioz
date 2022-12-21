<script lang="ts">
	import type { PageData } from './$types';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';

	export let data: PageData;

	let formData: {
		[key: string]: unknown;
	} = {};
</script>

<ScoutingForm layout={data.layout} bind:formData teamNumber={data.teamNumber} />

<!-- todo: submit data -->
