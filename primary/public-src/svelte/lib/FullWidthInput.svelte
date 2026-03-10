<script lang="ts">
	import Button from '@smui/button';
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';
	let { label, helper: helperText, submit, type, value = $bindable<string>(), onclick  } = $props();

	
</script>

<div class="grid max-md:grid-cols-1! gap-1" style='grid-template-columns: auto 100px'>
	<div>
		<Textfield
			variant="filled"
			style="width: 100%"
			bind:value
			label={label}
			type={type}
			onkeydown={(e) => {if (e.key === 'Enter') onclick()}}
			autofocus
		>
			{#snippet helper()}
				<HelperText>{helperText}</HelperText>
			{/snippet}
		</Textfield>
	</div>
	<Button variant="unelevated" class="md:h-14!" {onclick}>{submit}</Button>
</div>
