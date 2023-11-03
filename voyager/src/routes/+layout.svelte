<script lang="ts">
	// import BottomAppBar, { Section, AutoAdjust } from '@smui-extra/bottom-app-bar';
	import TopAppBar, { Row, Section, AutoAdjust } from '@smui/top-app-bar';
	import Drawer, {
		AppContent,
		Content as DContent,
		Header as DHeader,
		Title as DTitle,
		Subtitle as DSubtitle,
		Scrim
	} from '@smui/drawer';
	import List, {
		Item as LItem,
		Text as LText,
		Graphic as LGraphic,
		Separator as LSeparator,
		Subheader as LSubheader
	} from '@smui/list';

	import BottomNavBar from '$lib/nav/BottomNavBar.svelte';
	import type { NavBarItem } from '$lib/nav/BottomNavBar.svelte';

	import { userName, org_key } from '$lib/stores';
	import { afterNavigate } from '$app/navigation';
	import IconButton from '@smui/icon-button';
	import { assets } from '$app/paths';
	import { share } from '$lib/share';

	afterNavigate(() => (menuOpen = false));

	let topAppBar: TopAppBar;
	// let bottomAppBar: BottomAppBar;
	let menuOpen = false;

	// JL note: I think maybe these items can change contextually depending on
	// 	what the user is doing?
	let navItems: NavBarItem[] = [
		{
			label: 'Menu',
			onClick: () => (menuOpen = true),
			icon: 'menu'
		},
		{
			label: 'Match scouting',
			icon: 'stadium',
			href: '/scouting/match'
		},
		{
			label: 'Pit scouting',
			icon: 'handyman',
			href: '/scouting/pit'
		}
	];
</script>

<!-- modal is better but it won't close, so dismissible with position:fixed works -->
<Drawer variant="modal" bind:open={menuOpen} fixed={true}>
	<DHeader>
		<DTitle>Welcome, {$userName}</DTitle>
		<DSubtitle>{$org_key}</DSubtitle>
	</DHeader>
	<DContent>
		<List>
			<LItem href="/">
				<LGraphic class="material-icons" aria-hidden="true">home</LGraphic>
				<LText>Home</LText>
			</LItem>
			<LItem href="/schedule">
				<LGraphic class="material-icons" aria-hidden="true">calendar_month</LGraphic>
				<LText>Schedule</LText>
			</LItem>

			<LSeparator />
			<LSubheader tag="h6">Scouter</LSubheader>
			<LItem href="/scouting/pit">
				<LGraphic class="material-icons" aria-hidden="true">handyman</LGraphic>
				<LText>Pit scouting</LText>
			</LItem>
			<LItem href="/scouting/match">
				<LGraphic class="material-icons" aria-hidden="true">stadium</LGraphic>
				<LText>Match scouting</LText>
			</LItem>
			<LItem href="/sync/scouter">
				<LGraphic class="material-icons" aria-hidden="true">sync</LGraphic>
				<LText>Sync</LText>
			</LItem>

			<LSeparator />
			<LSubheader tag="h6">Lead</LSubheader>
			<LItem href="/assignments">
				<LGraphic class="material-icons" aria-hidden="true">assignment_ind</LGraphic>
				<LText>Manage assignments</LText>
			</LItem>
			<LItem href="/user/login/lead">
				<LGraphic class="material-icons" aria-hidden="true">login</LGraphic>
				<LText>Log in</LText>
			</LItem>
			<LItem href="/sync/lead">
				<LGraphic class="material-icons" aria-hidden="true">sync</LGraphic>
				<LText>Sync</LText>
			</LItem>

			<LSeparator />
			<LItem href="/debug">
				<LGraphic class="material-icons" aria-hidden="true">bug_report</LGraphic>
				<LText>Debug</LText>
			</LItem>
		</List>
	</DContent>
</Drawer>

<Scrim />
<!-- <AutoAdjust {bottomAppBar} style='display: flex; min-height: 100vh; box-sizing: border-box;'> -->
<!-- 	<AppContent style='flex-grow: 1;' class='mdc-typography'> -->
<!-- 		<slot /> -->
<!-- 	</AppContent> -->
<!-- </AutoAdjust> -->

<TopAppBar bind:this={topAppBar} variant={menuOpen ? 'fixed' : 'standard'} dense style="z-index: 5">
	<Row>
		<Section>
			<IconButton
				class="material-icons"
				aria-label="Open menu"
				on:click={() => {
					menuOpen = !menuOpen;
				}}>menu</IconButton
			>
			<a href="/" class="header-logo">
				<img src={`${assets}/images/brand-logos/scoutradioz-white-sm.png`} alt="Scoutradioz logo" />
			</a>
		</Section>
		<Section align="end" toolbar>
			<IconButton class="material-icons" aria-label="Sync" href="/sync">sync</IconButton>
			<!-- <IconButton class="material-icons" aria-label="Change language">language</IconButton> -->
			<IconButton class="material-icons" aria-label="Share" on:click={() => share()}
				>share</IconButton
			>
		</Section>
	</Row>
</TopAppBar>

<AutoAdjust {topAppBar}>
	<div id="page">
		<slot />
	</div>
</AutoAdjust>

<!-- <BottomNavBar bind:bottomAppBar items={navItems}/> -->

<style lang="scss">
	/* Hide everything above this component. */
	:global(app),
	:global(body),
	:global(html) {
		display: block !important;
		height: auto !important;
		width: auto !important;
		position: static !important;
	}
	:global(.mdc-drawer--modal) {
		top: 0;
	}
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
	#page {
		padding: 0 0.5em;
	}
</style>
