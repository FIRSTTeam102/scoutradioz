<script lang="ts">
	import Tab, { Label } from '@smui/tab';
	import TabBar from '@smui/tab-bar';
	import { fly } from 'svelte/transition';

	export let tabs: SlidingTab[];

	interface SlidingTab {
		label: string;
		component: any;
	}

	let tabLabels = tabs.map((tab) => tab.label);
	let activeTab = tabs[0].label;

	let windowWidth: number;
	let sliding = false;

	let prevTabIndex = 0;

	// positive or negative 1
	let direction = -1;

	function handleTabChange(e: any) {
		if (e.detail.index > prevTabIndex) {
			direction = 1;
		} else {
			direction = -1;
		}
		prevTabIndex = e.detail.index;
	}
</script>

<svelte:window bind:innerWidth={windowWidth} />

<TabBar tabs={tabLabels} let:tab bind:active={activeTab} on:SMUITabBar:activated={handleTabChange}>
	<Tab {tab}>
		<Label>{tab}</Label>
	</Tab>
</TabBar>
<div class="container">
	{#each tabs as tab}
		{#if activeTab === tab.label}
			<div
				transition:fly|local={{ x: direction * windowWidth, duration: 300 }}
				on:introstart={() => (sliding = true)}
				on:introend={() => (sliding = false)}
				on:outrostart={() => (sliding = true)}
				on:outroend={() => (sliding = false)}
				class:sliding
			>
				<svelte:component this={tab.component}/>
			</div>
		{/if}
	{/each}
</div>

<style lang="scss">
	.sliding {
		position: absolute;
		width: 100%;
		top: 0px;
		left: 0px;
		right: 0px;
		bottom: 0px;
		overflow: hidden;
	}
	.container {
		position: relative;
		min-height: 100%;
		flex-grow: 10;
		overflow-x: hidden;
	}
</style>
