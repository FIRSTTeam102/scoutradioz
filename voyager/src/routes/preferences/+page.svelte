<script lang="ts">
	import { msg } from '$lib/i18n';
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';
	import { preferences, } from '$lib/stores';
</script>

<section class="comfortable">
	<h1>{msg('user.preferences.title')}</h1>
	<div class="flex flex-col">
		<FormField>
			<Checkbox bind:checked={$preferences.enableAutoSync} touch />
			<span slot="label">{msg('user.preferences.enableAutoSync')}</span>
		</FormField>
	</div>
</section>
