<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { Html5Qrcode, Html5QrcodeSupportedFormats as Formats } from 'html5-qrcode';
	import type { Html5QrcodeCameraScanConfig } from 'html5-qrcode/html5-qrcode';

	let html5QrCode: Html5Qrcode;
	let scanning = false;
	let reader: HTMLDivElement;
	let windowWidth: number, windowHeight: number;
	let resizeTicking = false;
	
	/**
	 * Allow the scanner to be enabled or disabled.
	 */
	export let enabled: boolean = true;
	
	/**
	 * Delay between multiple dispatches of the "data" event, to avoid spamming the parent component (ms)
	 */
	export let qrCodeDataDelay = 2000;
	
	$: 
	if (enabled) startCamera();
	else stopCamera();
	
	// Dispatcher lets us send a custom 'data' event where the qr code has been read
	const dispatch = createEventDispatcher();

	// When the document visibilityState is changed, i.e. when the tab is switched or phone is turned off, we want to turn off the camera
	function onVisibilityChanged() {
		if (document.hidden) {
			stopCamera();
		} else {
			startCamera();
		}
	}
	
	// We don
	let lastDispatchTime = 0;
	function onQrCodeData(decodedText: string, data: unknown) {
		let now = Date.now();
		if (now - lastDispatchTime > qrCodeDataDelay) {
			dispatch('data', {
				text: decodedText
			});
			lastDispatchTime = now;
		}
		else {
			console.log('Waiting before dispatching event');
		}
	}
	
	const resizeDelay = 500;
	
	// Handle resize of the window
	function onResize() {
		// Don't immediately resize the viewport; wait a few ticks and then stop/start the camera
		if (!resizeTicking) {
			resizeTicking = true;
			setTimeout(async () => {
				
				if (scanning)
					await stopCamera();
				reader.setAttribute('width', `${windowWidth * 2}px`);
				reader.setAttribute('height', `${windowHeight * 2}px`);
				
				startCamera();
				resizeTicking = false;
			}, resizeDelay);
		}
	}
	
	const config: Html5QrcodeCameraScanConfig = {
		fps: 20, // Optional, frame per seconds for qr code scanning
		// qrbox: { width: 250, height: 250 }, // Optional, if you want bounded box UI
		disableFlip: false,
		resolutionMultiple: 2,
	}
	
	async function startCamera() {
		if (html5QrCode && !scanning && enabled) {
			console.log('Starting camera');
			try {
				await html5QrCode.start(
					{facingMode: 'environment'},
					config,
					onQrCodeData,
					(errorMessage) => {
						// console.error(errorMessage)
					}
				);
				scanning = true;
			}
			catch (err) {
				console.error(err);
			}
		}
	}
	
	async function stopCamera() {
		if (html5QrCode && scanning) {
			console.log('Stopping camera');
			await html5QrCode.stop();
			scanning = false;
		}
	}

	onMount(() => {
		document.addEventListener('visibilitychange', onVisibilityChanged);
		
		reader.setAttribute('width', `${windowWidth * 2}px`);
		reader.setAttribute('height', `${windowHeight * 2}px`);

		html5QrCode = new Html5Qrcode('reader', {
			formatsToSupport: [Formats.QR_CODE],
			verbose: false,
			useBarCodeDetectorIfSupported: false,
		});
		
		console.log('eee', html5QrCode);
		if (!document.hidden)
			startCamera();
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', onVisibilityChanged);
		stopCamera();
	});
</script>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} on:resize={onResize}/>

<div id="parent">
	<!-- 2x width and height so we can scan at a higher resolution on mobile cameras -->
	<!-- <div id="reader" bind:this={reader} style:width={windowWidth * 2 + 'px'} style:height={windowHeight * 2 + 'px'} />	 -->
	<div id="reader" bind:this={reader} style:width={windowWidth + 'px'} style:height={windowHeight + 'px'} />	
</div>

<style lang="scss">
	#reader {
		max-width: 100%;
		max-height: 100%;
		// transform: scale(0.5) translate(-50%, -50%);
		// position: absolute!important;
	}
	#parent {
		position: relative;
		width: 100%;
	}
</style>