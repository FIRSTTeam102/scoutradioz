<script lang="ts">
	import { classMap } from '@smui/common/internal';
	import Drawer, {
		Content as DContent,
		Header as DHeader,
		Subtitle as DSubtitle,
		Title as DTitle,
		Scrim
	} from '@smui/drawer';
	import List, {
		Graphic as LGraphic,
		Item as LItem,
		Separator as LSeparator,
		Subheader as LSubheader,
		Text as LText
	} from '@smui/list';
	import Tooltip, { Wrapper } from '@smui/tooltip';
	import TopAppBar, { Row, Section, Title as TABTitle } from '@smui/top-app-bar';

	import { afterNavigate } from '$app/navigation';
	import { assets } from '$app/paths';
	import { alertStore, deviceOnline } from '$lib/stores';
	import type {
		DialogContext,
		RefreshButtonAnimationContext,
		RefreshContext,
		SnackbarContext,
		TitleContext
	} from '$lib/types';
	import IconButton from '@smui/icon-button';
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';

	import LanguagePicker from '$lib/LanguagePicker.svelte';
	import SimpleSnackbar from '$lib/SimpleSnackbar.svelte';
	import { msg } from '$lib/i18n';

	import SimpleDialog from '$lib/SimpleDialog.svelte';
	import { getLogger } from '$lib/logger';
	import SvelteMarkdown from 'svelte-markdown';
	import '../theme/extras.scss';
	import type { LayoutData } from './$types';

	afterNavigate(() => (menuOpen = false));

	export let data: LayoutData;

	const logger = getLogger('layout');

	let topAppBar: TopAppBar;
	let headerBar: HTMLDivElement;
	let menuOpen = false;
	let headerBarHeight = NaN;

	let snackbar: SimpleSnackbar;
	let dialog: SimpleDialog;
	let languagePicker: LanguagePicker;

	let dialogContext: DialogContext = {
		show: (...args) => {
			if (!dialog) throw new Error('Dialog not defined');
			return dialog.show(...args);
		}
	};

	setContext('dialog', dialogContext);

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
		tooltip: ''
	});

	setContext('refreshButton', refreshContext);

	let refreshButtonSpinning = false;
	let timeRefreshButtonWasPressed = 0; // For smooth stopping
	const ANIMATION_TIME = 1000;

	const title: TitleContext = writable('');
	const subtitle: TitleContext = writable('');

	setContext('title', title);
	setContext('subtitle', subtitle);

	const refreshButtonAnimationContext: RefreshButtonAnimationContext = {
		play: () => {
			refreshButtonSpinning = true;
			timeRefreshButtonWasPressed = Date.now();
		},
		stop: () => {
			// Only set refreshButtonSpinning = false after some multiple of [animation_time] seconds after it started playing
			let timeRemainingInAnimation = ANIMATION_TIME - ((Date.now() - timeRefreshButtonWasPressed) % ANIMATION_TIME);
			setTimeout(() => {
				refreshButtonSpinning = false;
			}, timeRemainingInAnimation);
		},
		async autoplay(cb) {
			this.play();
			try {
				await cb();
			} catch (err) {
				throw err; // Propagate the error
			} finally {
				this.stop();
			}
		}
	};

	setContext('refreshButtonAnimation', refreshButtonAnimationContext);

	// 2023-11-11 JL: SMUI's AutoAdjust behavior led to the header bar not
	//  fully appearing when the page is *just barely* taller than 1vh
	let lastScrollTop = 0;
	let headerBarHidden = false;

	const onScroll = () => {
		// we want to keep as little code as possible in here for performance reasons
		// so anything that persists should be declared outside of it

		let scrollTop = window.scrollY;

		// only update if there was enough of a change
		if (Math.abs(lastScrollTop - scrollTop) <= headerBarHeight) return;

		headerBarHidden =
			scrollTop > lastScrollTop &&
			scrollTop > 0 /* don't hide bar if iphone scrolls up into the negatives and pops back  */;
		// // Scrolled down, hide
		// if (scrollTop > lastScrollTop) headerBar.classList.add('hidden');
		// // Scrolled up, show
		// else headerBar.classList.remove('hidden');

		// lastScrollTop will only update in blocks of headerbarHeight since it's after the return
		lastScrollTop = scrollTop;
	};

	let updateAvailable = false;
	let updateInstalling = false;
	let waitingWorker: ServiceWorker | null = null;

	onMount(async () => {
		alertStore.subscribe((value) => {
			if (value) {
				snackbar.open(value.message, undefined, undefined, value.type);
				alertStore.set(null);
			}
		});

		if ('serviceWorker' in navigator) {
			if ($deviceOnline) {
				logger.info('Device online; attempting to register serviceWorker');
				attemptServiceWorkerRegistration().catch((err) => logger.error(err));
			} else {
				logger.info('Device not online; Waiting for that to change');
				let unsub = deviceOnline.subscribe((online) => {
					if (online) {
						attemptServiceWorkerRegistration()
							.then(unsub)
							.catch((err) => logger.error(err));
					}
				});
			}
		} else logger.error('serviceWorker not found!');

		// show a snackbar if we just got an update
		if (sessionStorage.getItem('justUpdated') === 'true') {
			snackbar.open(msg('pwa.justUpdated'));
			sessionStorage.removeItem('justUpdated');
		}
	});

	async function attemptServiceWorkerRegistration() {
		logger.debug('Attempting to register serviceworker');
		navigator.serviceWorker.addEventListener('message', (event) => {
			if (!event.data) return;
			// Only reload the page if we've marked an update as being available
			if (event.data.msg === 'UPDATE_DONE') {
				let newVersion = String(event.data.version);
				logger.warn(`Update done! Version=${newVersion}`);
				updateInstalling = false;
				// Save the version of the newly installed service worker
				localStorage.setItem('serviceWorkerVersion', newVersion);
				if (!updateAvailable) return;
				sessionStorage.setItem('justUpdated', 'true'); // store a flag for a message to show once the page reloads
				location.reload();
			}
			if (event.data.msg === 'RETURN_VERSION') {
				let lastKnownVersion = localStorage.getItem('serviceWorkerVersion');
				let currentVersion = String(event.data.version);
				logger.debug(
					`Received service worker version: ${currentVersion} - Last known worker version: ${lastKnownVersion}`
				);
				if (lastKnownVersion !== currentVersion) {
					logger.info('Version mismatch found! Notifying user and saving version...');
					localStorage.setItem('serviceWorkerVersion', currentVersion);
					snackbar.open(msg('pwa.justUpdated'));
				}
			}
		});
		const registration = await navigator.serviceWorker.register('/service-worker.js', {
			type: 'module'
		});

		if (registration.installing) {
			updateInstalling = true;
		}

		// If we have a currently active service worker AND one that's waiting for activation, then we can say that an update is available
		if (registration.waiting && registration.active) {
			waitingWorker = registration.waiting;
			updateAvailable = true;
		}

		if (registration.active && !registration.waiting && !registration.installing) {
			logger.warn('There is an active worker and none that are installing or waiting. Requesting current version...');
			if (registration.active !== navigator.serviceWorker.controller)
				logger.warn('navigator.serviceWorker.controller is not the same as registration.active!');
			registration.active.postMessage({ msg: 'GET_VERSION' });
		}

		registration.onupdatefound = () => {
			logger.warn(
				`updatefound event firing! installing=${!!registration.installing}, waiting=${!!registration.waiting}`
			);
			// Only show an update available if there's currently a service worker
			if (registration.installing && registration.active) {
				updateInstalling = true;
				let installingWorker = registration.installing;
				installingWorker.onstatechange = () => {
					if (installingWorker.state === 'installed') {
						logger.warn('New worker is waiting to be activated!');
						updateAvailable = true;
						updateInstalling = false;
						waitingWorker = installingWorker;
					}
					if (installingWorker.state === 'activated') {
						updateInstalling = false;
					}
				};
			}
		};
		logger.trace('Done with attemptServiceWorkerRegistration');
	}

	async function handleInstallButtonClick() {
		if (!waitingWorker) return snackbar.error('waitingWorker not defined!');
		// let result = await dialogContext.show()
		logger.info('Posting SKIP_WAITING message to service worker!');
		waitingWorker.postMessage({ msg: 'SKIP_WAITING' });
	}
</script>

<svelte:window on:scroll={onScroll} />

<div class="header-bar" bind:this={headerBar} class:slidAway={headerBarHidden} bind:clientHeight={headerBarHeight}>
	<TopAppBar bind:this={topAppBar} variant="static" dense style="z-index: 5">
		<Row>
			<Section>
				<IconButton
					class="material-icons"
					aria-label="Open menu"
					on:click={() => {
						menuOpen = !menuOpen;
					}}>menu</IconButton>
				<IconButton class="header-logo" disabled>
					<img src={`${assets}/icon-64.png`} alt="Scoutradioz logo" />
				</IconButton>
				<TABTitle>
					<p class="title">
						<SvelteMarkdown source={$title} isInline />
					</p>
					{#if $subtitle}
						<p class="subtitle">
							<SvelteMarkdown source={$subtitle} isInline />
						</p>
					{/if}
				</TABTitle>
			</Section>
			<Section align="end" toolbar>
				{#if updateAvailable}
					<Wrapper>
						<IconButton class="material-icons" on:click={handleInstallButtonClick}>system_update</IconButton>
						<Tooltip>{msg('pwa.updateAvailable')}</Tooltip>
					</Wrapper>
				{/if}
				{#if updateInstalling}
					<Wrapper>
						<IconButton class="material-icons hourglass">hourglass_empty</IconButton>
						<Tooltip>{msg('pwa.updateDownloading')}</Tooltip>
					</Wrapper>
				{/if}
				{#if $refreshContext.supported}
					<Wrapper>
						<IconButton
							class={classMap({
								'material-icons': true,
								'refreshButton': true,
								'spinning': refreshButtonSpinning
							})}
							aria-label="Sync"
							on:click={async () => {
								if (!$refreshContext.onClick) return;
								refreshButtonAnimationContext.play();
								await $refreshContext.onClick();
								refreshButtonAnimationContext.stop();
							}}
							disabled={!$deviceOnline || refreshButtonSpinning}>
							{#if $deviceOnline}
								sync
							{:else}
								sync_disabled
							{/if}
						</IconButton>
						<Tooltip>{$refreshContext.tooltip || ''}</Tooltip>
					</Wrapper>
				{/if}
				<!-- <Wrapper> -->
				<!-- 	<IconButton class="material-icons" aria-label="Share" on:click={() => share()} -->
				<!-- 		>qr_code_scanner</IconButton -->
				<!-- 	> -->
				<!-- 	<Tooltip>Share</Tooltip> -->
				<!-- </Wrapper> -->
			</Section>
		</Row>
	</TopAppBar>
</div>

<div id="page">
	<slot />
</div>

<SimpleSnackbar bind:this={snackbar} />
<SimpleDialog bind:this={dialog} />
<LanguagePicker bind:this={languagePicker} />

<!-- modal is better but it won't close, so dismissible with position:fixed works -->
<Drawer variant="modal" bind:open={menuOpen} fixed={true}>
	<DHeader>
		{#if data.user && data.org}
			<DTitle>{msg('hello.name', { name: data.user.name })}</DTitle>
			<DSubtitle>{data.org.nickname}</DSubtitle>
		{:else}
			<DTitle>{msg('index.welcome')}</DTitle>
		{/if}
	</DHeader>
	<DContent>
		<List>
			<LItem href="/home">
				<LGraphic class="material-icons" aria-hidden="true">home</LGraphic>
				<LText>{msg('home.title')}</LText>
			</LItem>
			<!-- <LItem href="/schedule">
				<LGraphic class="material-icons" aria-hidden="true">calendar_month</LGraphic>
				<LText>Schedule</LText>
			</LItem> -->
			<!-- If logged in to an org -->
			{#if data.org}
				{#if $deviceOnline}
					<LItem href="/login/switch-org">
						<LGraphic class="material-icons" aria-hidden="true">logout</LGraphic>
						<LText>{msg('layout.nav.user.switchorg')}</LText>
					</LItem>
				{:else}
					<LItem disabled>
						<LGraphic class="material-icons unimportant" aria-hidden="true">logout</LGraphic>
						<LText>{msg('layout.nav.user.switchorgoffline')}</LText>
					</LItem>
				{/if}
				<LItem href="/login/pick-user">
					<LGraphic class="material-icons" aria-hidden="true">login</LGraphic>
					<LText>{msg('layout.nav.user.pickuser')}</LText>
				</LItem>
				<!-- Not logged in to an org -->
			{:else if $deviceOnline}
				<LItem href="/login">
					<LGraphic class="material-icons" aria-hidden="true">login</LGraphic>
					<LText>{msg('layout.nav.user.selectorg')}</LText>
				</LItem>
			{:else}
				<LItem disabled>
					<LGraphic class="material-icons unimportant" aria-hidden="true">login</LGraphic>
					<LText>{msg('layout.nav.user.selectorgoffline')}</LText>
				</LItem>
			{/if}
			<LItem href="/preferences">
				<LGraphic class="material-icons" aria-hidden="true">settings</LGraphic>
				<LText>{msg('user.preferences.title')}</LText>
			</LItem>
			<LItem
				on:click={() => {
					menuOpen = false;
					languagePicker.open();
				}}>
				<LGraphic class="material-icons" aria-hidden="true">language</LGraphic>
				<LText>{msg('language')}</LText>
			</LItem>

			<LSeparator />
			<LSubheader tag="h6">Scouter</LSubheader>
			<LItem href="/scouting/pit">
				<LGraphic class="material-icons" aria-hidden="true">handyman</LGraphic>
				<LText>{msg('scouting.pit')}</LText>
			</LItem>
			<LItem href="/scouting/match">
				<LGraphic class="material-icons" aria-hidden="true">stadium</LGraphic>
				<LText>{msg('scouting.match')}</LText>
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
		</List>
	</DContent>
</Drawer>

<Scrim />

<style lang="scss">
	/* Hide everything above this component. */
	$header-height: 48px;
	.header-bar {
		position: fixed;
		z-index: 5;
		width: 100%;
		top: 0px;
		transition: top 0.15s ease-out;
		&:global(.slidAway) {
			top: -$header-height;
		}
		& :global(p) {
			margin: 0;
		}
	}
	:global(.mdc-top-app-bar) {
		top: 0px;
		// transition: top .15s ease-in-out, box-shadow 200ms linear!important; // todo anim vars
	}
	#page {
		padding-top: $header-height;
		// margin-top: $header-height;
		// overflow: auto;
		// display: flex;
		// flex-direction: column;
		// position: relative;
	}
	:global(app),
	:global(body),
	:global(html) {
		display: block !important;
		height: auto !important;
		width: auto !important;
		position: static !important;
		// display: flex;
		// flex-direction: column;
		// height: 100vh;
	}
	:global(.mdc-drawer--modal) {
		top: 0;
	}
	:global(.header-logo) {
		padding-left: 0px;
		padding-right: 0px;
		margin-left: -8px;
		margin-right: -12px;
		img {
			max-width: 100%;
			max-height: 100%;
			vertical-align: middle;
		}
	}
	.title {
		line-height: 1.625rem;
	}
	.subtitle {
		font-size: 0.8rem;
		opacity: 0.7;
		line-height: 1.125rem;
	}
	// #page {
		// padding: 0 0.5em;
	// }
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
	:global(.hourglass) {
		animation-name: hourglass;
		animation-duration: 4s;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}
	@keyframes hourglass {
		0% {
			transform: rotate(0deg);
		}
		20% {
			transform: rotate(180deg);
		}
		100% {
			transform: rotate(180deg);
		}
	}
</style>
