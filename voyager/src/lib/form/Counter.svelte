<script lang="ts">
	import Fab, { Icon } from '@smui/fab';
	import type { LayoutField } from '$lib/types';

	export let value: any = 0; // any because of weird casting to generic data
	export let field: LayoutField;
	export let isBad = false;
	const changeByValue = (change: number) => (value = Math.max(0, value + change));
</script>

<div>
	<Fab mini class={!isBad ? 'bad' : 'good'} on:click={() => changeByValue(-1)}>
		<Icon class="material-icons">remove</Icon>
	</Fab>
	<span>{field.label}: {value}</span>
	<Fab mini class={!isBad ? 'good' : 'bad'} on:click={() => changeByValue(1)}>
		<Icon class="material-icons">add</Icon>
	</Fab>
</div>

<style lang="scss">
	@use '@material/fab/index' as mdc-fab;
	@use '@material/theme/color-palette';

	div {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}

	:global {
		.good {
			@include mdc-fab.accessible(color-palette.$blue-300);
		}
		.bad {
			@include mdc-fab.accessible(color-palette.$red-900);
			@include mdc-fab.shape-radius(25%);
		}
	}
</style>
