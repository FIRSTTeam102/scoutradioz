<script lang="ts">
	import { classMap } from '@smui/common/internal';
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
	import Tooltip, { Wrapper } from '@smui/tooltip';

	import { userName, org_key, deviceOnline } from '$lib/stores';
	import { afterNavigate } from '$app/navigation';
	import IconButton from '@smui/icon-button';
	import { assets } from '$app/paths';
	import { share } from '$lib/share';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	import { setContext } from 'svelte';
	import type { RefreshButtonAnimationContext, RefreshContext, SnackbarContext } from '$lib/types';
	import { writable } from 'svelte/store';

	afterNavigate(() => (menuOpen = false));

	let topAppBar: TopAppBar;
	let menuOpen = false;

	let snackbar: SimpleSnackbar;

	let snackbarContext: SnackbarContext = {
		open: (...args) => {
			if (!snackbar) throw new Error('Snackbar not defined');
			return snackbar.open(...args);
		},
		error: (...args) => {
			if (!snackbar) throw new Error('Snackbar not defined');
			return snackbar.error(...args);
		},
		close: (...args) => {
			if (!snackbar) throw new Error('Snackbar not defined');
			return snackbar.close(...args);
		}
	};

	setContext('snackbar', snackbarContext);

	// Define a store with a supported flag and contextual data refresh function
	const refreshContext: RefreshContext = writable({
		supported: false,
		onClick: () => {},
		tooltip: '',
	});

	setContext('refreshButton', refreshContext);
	
	let refreshButtonSpinning = false;
	let timeRefreshButtonWasPressed = 0; // For smooth stopping
	const ANIMATION_TIME = 1000;
	
	const refreshButtonAnimationContext: RefreshButtonAnimationContext = {
		play: () => {
			refreshButtonSpinning = true;
			timeRefreshButtonWasPressed = Date.now();
		},
		stop: () => {
			// Only set refreshButtonSpinning = false after some multiple of [animation_time] seconds after it started playing
			let timeRemainingInAnimation = ANIMATION_TIME - ((Date.now() - timeRefreshButtonWasPressed) % ANIMATION_TIME)
			setTimeout(() => {
				refreshButtonSpinning = false;
			}, timeRemainingInAnimation);
		},
		async autoplay(cb) {
			this.play();
			await cb();
			this.stop();
		}
	}
	
	setContext('refreshButtonAnimation', refreshButtonAnimationContext);

	// function clearCache() {
	// 	if ('serviceWorker' in navigator) {
	// 		if ('controller' in navigator.serviceWorker && !!navigator.serviceWorker.controller) {
	// 			navigator.serviceWorker.controller.postMessage('clearCache');
	// 		}
	// 		else snackbarContext.error('Could not find navigator.serviceWorker.controller!');
	// 	}
	// 	else snackbarContext.error('Could not find navigator.serviceWorker!');
	// }
</script>

<!-- modal is better but it won't close, so dismissible with position:fixed works -->
<Drawer variant="modal" bind:open={menuOpen} fixed={true}>
	<DHeader>
		<DTitle>Welcome, {$userName}</DTitle>
		<DSubtitle>{$org_key}</DSubtitle>
	</DHeader>
	<DContent>
		<List>
			<LItem href="/home">
				<LGraphic class="material-icons" aria-hidden="true">home</LGraphic>
				<LText>Home</LText>
			</LItem>
			<LItem href="/schedule">
				<LGraphic class="material-icons" aria-hidden="true">calendar_month</LGraphic>
				<LText>Schedule</LText>
			</LItem>
			<LItem href="/">
				<LGraphic class="material-icons" aria-hidden="true">logout</LGraphic>
				<LText>Switch org & user</LText>
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
			<!-- <LItem href="/assignments">
				<LGraphic class="material-icons" aria-hidden="true">assignment_ind</LGraphic>
				<LText>Manage assignments</LText>
			</LItem>
			<LItem href="/user/login/lead">
				<LGraphic class="material-icons" aria-hidden="true">login</LGraphic>
				<LText>Log in</LText>
			</LItem> -->
			<LItem href="/sync/lead">
				<LGraphic class="material-icons" aria-hidden="true">sync</LGraphic>
				<LText>Sync</LText>
			</LItem>

			<LSeparator />
			<LItem href="/debug">
				<LGraphic class="material-icons" aria-hidden="true">bug_report</LGraphic>
				<LText>Debug</LText>
			</LItem>
			<!-- <LItem on:click={clearCache}>
				<LGraphic class="material-icons" aria-hidden="true">update</LGraphic>
				<LText>App update</LText>
			</LItem> -->
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
			<a href="/home" class="header-logo">
				<img src={`${assets}/images/brand-logos/scoutradioz-white-sm.png`} alt="Scoutradioz logo" />
			</a>
		</Section>
		<Section align="end" toolbar>
			{#if $refreshContext.supported}
				<Wrapper>
					<IconButton
						class={classMap({ 'material-icons': true, 'refreshButton': true, 'spinning': refreshButtonSpinning, })}
						aria-label="Sync"
						on:click={async () => {
							if (!$refreshContext.onClick) return;
							refreshButtonAnimationContext.play();
							await $refreshContext.onClick();
							refreshButtonAnimationContext.stop();
						}}
						disabled={!$deviceOnline || refreshButtonSpinning}>sync</IconButton
					>
					{#if $refreshContext.tooltip}
						<Tooltip>{$refreshContext.tooltip}</Tooltip>
					{/if}
				</Wrapper>
			{/if}
			<!-- <IconButton class="material-icons" aria-label="Change language">language</IconButton> -->
			<Wrapper>
				<IconButton class="material-icons" aria-label="Share" on:click={() => share()}>share</IconButton >
				<Tooltip>Share</Tooltip>
			</Wrapper>
		</Section>
	</Row>
</TopAppBar>

<AutoAdjust {topAppBar}>
	<div id="page">
		<slot />
	</div>
</AutoAdjust>

<SimpleSnackbar bind:this={snackbar} />

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
		// padding: 0 0.5em;
	}
	:global(.refreshButton:disabled) {
		opacity: 0.7;
	}
	:global(.refreshButton.spinning) {
		animation-name: spinny;
		animation-duration: 1s;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}
	@keyframes spinny {
		from {
			transform: rotate(0deg);
		}
		to {
			// JL note: can be 180deg because the icon is symmetrical
			transform: rotate(-180deg);
		}
	}
</style>
