<script lang="ts">
	import type { PageData } from './$types';
	import ScoutingForm from '$lib/form/ScoutingForm.svelte';
	import { event_key, org_key } from '$lib/stores';
	import { onMount } from 'svelte';
	import db from '$lib/localDB';

	export let data: PageData;

	let formData: {
		[key: string]: unknown;
	} = {};
	
	onMount(async () => {
		// Retrieve pit scouting data from db if it exists, once, when the page loads
		const existingData = await db.pitscouting.where({
			org_key: $org_key,
			event_key: $event_key,
			team_key: data.key,
		})
		.first();
		if (existingData && existingData.data) {
			formData = existingData.data;
		}
	})
</script>

<ScoutingForm layout={data.layout} bind:formData teamNumber={data.teamNumber} />

<!-- todo: submit data -->
