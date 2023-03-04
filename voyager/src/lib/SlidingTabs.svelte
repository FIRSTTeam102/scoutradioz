<!--
	@component 
	Tab bar that slickly slides between tabs. Each tab label must be unique, and each tab attaches a component that is imported.
	 
	Example usage:
	
		<script lang="ts">
			import Scanner from '../Scanner.svelte';
			import LeadQRCode from '../LeadQRCode.svelte';
			import LeadSyncMothership from '../LeadSyncMothership.svelte';
			import SlidingTabs from '$lib/SlidingTabs.svelte';
			
		</script>
		
		<SlidingTabs tabs={[
			{label: 'Scan', component: Scanner},
			{label: 'Show QR', component: LeadQRCode},
			{label: 'Server', component: LeadSyncMothership},
		]}
		/>
 -->


<script lang="ts">
	import Tab, { Label } from '@smui/tab';
	import TabBar from '@smui/tab-bar';
	import type { ComponentType } from 'svelte';
	import {  } from 'svelte/animate';
	import { fly } from 'svelte/transition';

	export let tabs: SlidingTab[];

	interface SlidingTab {
		label: string;
		component: ComponentType;
	}

	let tabLabels = tabs.map((tab) => tab.label);
	let activeTab = tabs[0].label;
	
	let sliding = false;

	let prevTabIndex = 0;

	let movingRight = true;

	function handleTabChange(e: {detail: {index: number}}) {

		movingRight = e.detail.index > prevTabIndex;
		prevTabIndex = e.detail.index;
	}
	
	const animationDuration = 300;
	
	function flyInTransition(node: Element) {
		let direction = movingRight ? -1 : 1;
		return fly(node, {
			y: direction * 50,
			duration: animationDuration
		});
	}
	
	function flyOutTransition(node: Element) {
		let direction = movingRight ? 1 : -1;
		return fly(node, {
			y: direction * 50,
			duration: animationDuration
		});
	}
</script>

<TabBar tabs={tabLabels} let:tab bind:active={activeTab} on:SMUITabBar:activated={handleTabChange}>
	<Tab {tab}>
		<Label>{tab}</Label>
	</Tab>
</TabBar>
<div class="container" class:sliding>
	{#each tabs as tab}
		{#if activeTab === tab.label}
			<div
				in:flyInTransition|local
				out:flyOutTransition|local
				on:introstart={() => {sliding = true}}
				on:introend={() => (sliding = false)}
				on:outrostart={() => (sliding = true)}
				on:outroend={() => (sliding = false)}
				class='child'
				class:sliding
			>
				<svelte:component this={tab.component} />
			</div>
		{/if}
	{/each}
</div>

<style lang="scss">
	.child.sliding {
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
	.container.sliding {
		overflow-y: hidden;
	}
</style>
