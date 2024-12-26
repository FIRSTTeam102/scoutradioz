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
	import assert from './assert';

	// export let tabs: SlidingTab[];
	// export let initialActiveIndex = 0;

	let { tabs, initialActiveIndex = 0 }: {tabs: SlidingTab[], initialActiveIndex?: number} = $props();

	interface SlidingTab {
		id: string;
		label: string;
		icon?: string;
		disabled?: boolean;
	}

	let activeTab: SlidingTab|undefined = $state();

	onMount(() => {
		// Default to first tab; otherwise, retrieve the tab from location.hash or use the initialActiveIndex if provided
		// todo later: maybe save it in localstorage?
		let hash = parseInt(location.hash.substring(1));
		if (initialActiveIndex) {
			activeTab = tabs[initialActiveIndex];
		} else if (hash && hash < tabs.length) {
			activeTab = tabs[hash];
		} else {
			activeTab = tabs[0];
		}
	});

	let sliding = $state(false);

	let prevTabIndex = 0;

	let movingRight = true;
	
	// let activeIndex = $derived.by(() => {
	// 	if (!activeTab) return;
	// 	// Find current tab index
	// 	let index = -1;
	// 	for (let i in tabs) {
	// 		if (activeTab.id === tabs[i].id) {
	// 			index = Number(i);
	// 			break;
	// 		}
	// 	}
	// 	assert(index >= 0, 'Could not find index in tabs');
	// 	return index;
	// });
	
	function getTabIndex(tabId: string) {
		for (let i in tabs) {
			if (tabId === tabs[i].id) {
				return Number(i);
			}
		}
		throw new Error('could not find index in tabs');
	}
	
	$effect(() => {
		if (!activeTab) return; // no assert necessary
		let activeTabIndex = getTabIndex(activeTab.id);
		goto('#' + activeTabIndex, {
			replaceState: true // Don't want the tab navigation to create a new history entry
		})
	});
	// function handleTabChange(e: { detail: { index: number } }) {
	// 	console.log('tabChange', e.detail.index);
	// 	// location.hash = String(e.detail.index);
	// 	goto('#' + e.detail.index, {
	// 	});
	// 	movingRight = e.detail.index > prevTabIndex;
	// 	prevTabIndex = e.detail.index;
	// }
	
	// JL note: this has to be handled on click instead of on a magic effect/derived handler 
	// 	because movingRight has to be identified before flyIn/flyOutTransition
	function handleTabClick(tabId: string) {
		assert(activeTab, 'activeTab not defined');
		let activeTabIndex = getTabIndex(activeTab.id);
		let newTabIndex = getTabIndex(tabId);
		movingRight = newTabIndex > activeTabIndex;
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
</script>

<TabBar {tabs} key={(tab) => tab.id} bind:active={activeTab}>
	{#snippet tab(tab)}
		<Tab {tab} disabled={tab.disabled} onclick={() => handleTabClick(tab.id)}>
			{#if tab.icon}
				<Icon class="material-icons">{tab.icon}</Icon>
			{/if}
			<Label>{tab.label}</Label>
		</Tab>
	{/snippet}
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
	{#if $$slots['1'] && activeTab?.id == tabs[0].id}
		<div
			in:flyInTransition|local
			out:flyOutTransition|local
			onintrostart={slideOn}
			onintroend={slideOff}
			onoutrostart={slideOff}
			onoutroend={slideOff}
			class="child"
			class:sliding
		>
			<slot name="1" />
		</div>
	{/if}
	{#if $$slots['2'] && activeTab?.id == tabs[1].id}
		<div
			in:flyInTransition|local
			out:flyOutTransition|local
			onintrostart={slideOn}
			onintroend={slideOff}
			onoutrostart={slideOff}
			onoutroend={slideOff}
			class="child"
			class:sliding
		>
			<slot name="2" />
		</div>
	{/if}
	{#if $$slots['3'] && activeTab?.id == tabs[2].id}
		<div
			in:flyInTransition|local
			out:flyOutTransition|local
			onintrostart={slideOn}
			onintroend={slideOff}
			onoutrostart={slideOff}
			onoutroend={slideOff}
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
	}
	.container {
		position: relative;
		min-height: 100%;
		flex-grow: 10;
	}
</style>
