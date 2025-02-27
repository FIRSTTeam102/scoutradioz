<script lang="ts">
	import { msg } from '$lib/i18n';
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';
	import { preferences } from '$lib/stores';
	import { setPageTitle } from '$lib/utils';

	setPageTitle(msg('user.preferences.title'));
</script>

<section class="comfortable">
	<div class="flex flex-col">
		<FormField>
			<Checkbox bind:checked={$preferences.enableAutoSync} touch />
			{#snippet label()}
				<span>{msg('user.preferences.enableAutoSync')}</span>
			{/snippet}
		</FormField>
	</div>
</section>
