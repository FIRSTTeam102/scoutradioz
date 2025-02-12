<script lang="ts">
	import Fab, { Icon } from '@smui/fab';
	import type { CounterItem } from 'scoutradioz-types';

	interface Props {
		value?: any; // any because of weird casting to generic data
		field: CounterItem;
		allow_negative?: boolean;
		isBad?: boolean;
		onchange: () => void;
	}

	let {
		value = $bindable(0),
		field,
		allow_negative = false,
		isBad = false,
		onchange
	}: Props = $props();
	const changeByValue = (change: number) => {
		value = (allow_negative ? value + change : Math.max(0, value + change));
		onchange();
	};
</script>

<div>
	<Fab mini class={!isBad ? 'bad' : 'good'} onclick={() => changeByValue(-1)}>
		<Icon class="material-icons">remove</Icon>
	</Fab>
	<span>{field.label}: {value}</span>
	<Fab mini class={!isBad ? 'good' : 'bad'} onclick={() => changeByValue(1)}>
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

	:global(.good) {
		@include mdc-fab.accessible(color-palette.$blue-300);
	}
	:global(.bad) {
		@include mdc-fab.accessible(color-palette.$red-900);
		@include mdc-fab.shape-radius(25%);
	}
</style>
