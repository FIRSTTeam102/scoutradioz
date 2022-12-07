<script lang="ts">
	import TopAppBar, { Row, Section, AutoAdjust } from '@smui/top-app-bar';
	import Drawer, { AppContent, Content, Header, Title, Subtitle, Scrim } from '@smui/drawer';

	import IconButton from '@smui/icon-button';
	import LoremIpsum from '$lib/LoremIpsum.svelte';

	let topAppBar: TopAppBar;
	let topBarHeight = 0; // todo:
	let menuOpen = false; // todo: why won't this update
</script>

<Drawer variant="modal" bind:open={menuOpen} style={`margin-top: ${topBarHeight}px;`}>
	<Header>
		<Title>Scoutradioz</Title>
		<Subtitle>Your name</Subtitle>
	</Header>
</Drawer>

<!-- must be between drawer and appbar -->
<Scrim />

<TopAppBar bind:this={topAppBar} variant={menuOpen ? 'fixed' : 'standard'} dense style="z-index: 5">
	<Row>
		<Section>
			<IconButton class="material-icons" aria-label="Open menu" on:click={() => {menuOpen = !menuOpen}}>menu</IconButton>
			<a href="/" class="header-logo">
				<img src="/images/brand-logos/scoutradioz-white-sm.png" alt="Scoutradioz logo" />
			</a>
		</Section>
		<Section align="end" toolbar>
			<IconButton class="material-icons" aria-label="Sync">sync</IconButton>
			<IconButton class="material-icons" aria-label="Change language">language</IconButton>
			<IconButton class="material-icons" aria-label="Share">share</IconButton>
		</Section>
	</Row>
</TopAppBar>

<AutoAdjust {topAppBar}>
	<slot></slot>
</AutoAdjust>

<style lang='scss'>
	.header-logo {
		height: 100%;
		display: block;
		padding: 6px;
		box-sizing: border-box;
	}
	.header-logo img {
		max-height: 100%; 
		max-width: 100%;
		vertical-align: middle;
		padding-left: 8px;
	}
</style>
  
  <!-- <style>
	/* Hide everything above this component. */
	:global(#smui-app),
	:global(body),
	:global(html) {
	  display: block !important;
	  height: auto !important;
	  width: auto !important;
	  position: static !important;
	}
  </style> -->
  