<script lang="ts">
	import BottomAppBar, { Section, AutoAdjust } from '@smui-extra/bottom-app-bar';
	import BottomNavigationButton from './BottomNavigationButton.svelte';
	import { classMap } from '@smui/common/internal';

	export let items: Array<NavBarItem>;

	export let bottomAppBar: BottomAppBar;
</script>
<script lang="ts" context='module'>
	export type NavBarItem = {
		label: string;
		icon: string;
		href?: string;
		onClick?: () => void;
	};
</script>

<BottomAppBar bind:this={bottomAppBar} variant="fixed">
	<Section style="justify-content:space-around;">
		{#each items as item}
			<BottomNavigationButton {...item} style={`width: ${99.999 / items.length}%;`}/>
		{/each}
	</Section>
</BottomAppBar>

<style>
	.unimportant {
		opacity: 60%;
	}
</style>