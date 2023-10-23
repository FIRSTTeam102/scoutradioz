<!--
	@component 
	Tab bar that slickly slides between tabs. Each tab id must be unique, and each tab attaches a component that is imported.
	 
	Example usage:
	
		<script lang="ts">
			import Scanner from '../Scanner.svelte';
			import LeadSyncMothership from '../LeadSyncMothership.svelte';
			import SlidingTabs from '$lib/SlidingTabs.svelte';
			import LeadQrCode from '../LeadQRCode.svelte';
			
			const tabs = [
				{label: 'Scan', id: 'scanner'},
				{label: 'Show QR', id: 'qr'},
				{label: 'Server', id: 'server'},
			];
			
		</script>
		
		<SlidingTabs {tabs}>
			<Scanner slot='1'/>
			<LeadQrCode slot='2'/>
			<LeadSyncMothership slot='3'/>
		</SlidingTabs>
 -->
<script lang="ts">
	import Tab, { Icon, Label } from '@smui/tab';
	import TabBar from '@smui/tab-bar';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';

	export let tabs: SlidingTab[];

	interface SlidingTab {
		id: string;
		label: string;
		icon?: string;
	}
	
	let activeTab: SlidingTab;

	onMount(() => {
		// Default to first tab; otherwise, retrieve the tab from location.hash
		// todo later: maybe save it in localstorage?
		let hash = parseInt(location.hash.substring(1));
		if (hash && hash < tabs.length) {
			activeTab = tabs[hash];
		} else {
			activeTab = tabs[0];
		}
	});

	let sliding = false;

	let prevTabIndex = 0;

	let movingRight = true;

	function handleTabChange(e: { detail: { index: number } }) {
		console.log('tabChange');
		// location.hash = String(e.detail.index);
		goto('#' + e.detail.index, {
			replaceState: true, // Don't want the tab navigation to create a new history entry
		});
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

	function tabLabelToHash(label: string) {
		return label.toLowerCase().replace(/[ ]/g, '_');
	}

	function slideOn() {
		sliding = true;
	}
	function slideOff() {
		sliding = false;
	}
	
	const maxTabs = 6;
</script>

<TabBar {tabs} let:tab bind:active={activeTab} on:SMUITabBar:activated={handleTabChange}>
	<Tab {tab}>
		{#if tab.icon}
			<Icon class='material-icons'>{tab.icon}</Icon>
		{/if}
		<Label>{tab.label}</Label>
	</Tab>
</TabBar>
<div class="container" class:sliding>
	<!-- {#each tabs as tab}
		{#if activeTab === tab.label}
			<div
				in:flyInTransition|local
				out:flyOutTransition|local
				on:introstart={() => {sliding = true}}
				on:introend={slideOff}
				on:outrostart={slideOff}
				on:outroend={slideOff}
				class='child'
				class:sliding
			>
				<svelte:component this={tab.component} />
			</div>
		{/if}
	{/each} -->
	{#if $$slots['1'] && activeTab == tabs[0]}
		<div
			in:flyInTransition|local
			out:flyOutTransition|local
			on:introstart={slideOn}
			on:introend={slideOff}
			on:outrostart={slideOff}
			on:outroend={slideOff}
			class="child"
			class:sliding
		>
			<slot name="1" />
		</div>
	{/if}
	{#if $$slots['2'] && activeTab == tabs[1]}
		<div
			in:flyInTransition|local
			out:flyOutTransition|local
			on:introstart={slideOn}
			on:introend={slideOff}
			on:outrostart={slideOff}
			on:outroend={slideOff}
			class="child"
			class:sliding
		>
			<slot name="2" />
		</div>
	{/if}
	{#if $$slots['3'] && activeTab == tabs[2]}
		<div
			in:flyInTransition|local
			out:flyOutTransition|local
			on:introstart={slideOn}
			on:introend={slideOff}
			on:outrostart={slideOff}
			on:outroend={slideOff}
			class="child"
			class:sliding
		>
			<slot name="3" />
		</div>
	{/if}
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
