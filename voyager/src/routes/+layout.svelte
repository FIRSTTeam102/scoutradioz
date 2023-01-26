<script lang="ts">
	import TopAppBar, { Row, Section, AutoAdjust } from '@smui/top-app-bar';
	import Drawer, {
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
	import IconButton from '@smui/icon-button';
	import { afterNavigate } from '$app/navigation';
	import { share } from '$lib/share';
	import { user, org_key } from '$lib/stores';
	import { assets } from '$app/paths'; // Assets path -- it returns something like _svelte_assets in localhost but https://scoutradioz-voyager.s3.amazonaws.com on AWS


	// close menu when changing pages
	afterNavigate(() => (menuOpen = false));

	let topAppBar: TopAppBar;
	let topBarHeight = 48; // todo: autocalculate
	let menuOpen = false;
</script>

<!-- modal is better but it won't close, so dismissible with position:fixed works -->
<Drawer
	variant="dismissible"
	bind:open={menuOpen}
	style={`margin-top: ${topBarHeight}px; position: fixed; height: calc(100% - ${topBarHeight}px); overflow-y: auto;`}
>
	<DHeader>
		<DTitle>Welcome, {$user}</DTitle>
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
		</List>
	</DContent>
</Drawer>

<!-- if using modal then it just works, otherwise we have to implement scrim ourselves -->
<!-- <Scrim /> -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
	class="mdc-drawer-scrim"
	style="background-color: rgba(255, 255, 255, 0.32); position: fixed"
	on:click={() => (menuOpen = false)}
/>

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

<style lang="scss">
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
