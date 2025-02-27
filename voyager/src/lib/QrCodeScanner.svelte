<script lang="ts">
	import { createEventDispatcher, getContext, onDestroy, onMount } from 'svelte';
	import { getAvailableWindowSize } from './utils';
	import { getLogger } from './logger';
	import type { SnackbarContext } from './types';
	import { UAParser } from 'ua-parser-js';

	const logger = getLogger('lib/QrCodeScanner');

	let useragent;
	let shouldFlipDimensionsInPortrait = false;
	let shouldRequestBiggerResolutionAndCrop = false;
	if ('navigator' in globalThis && 'userAgent' in navigator) {
		useragent = UAParser(navigator.userAgent);
		// Known devices that flip horizontal/vertical dimensions:
		// 	- iOS: all browsers, including firefox, only in portrait mode
		//  - Android: All browsers except firefox, only in portrait mode
		// 	- Desktop with webcam: None that I could find
		const isFirefox = useragent.browser.name?.toLowerCase().startsWith('firefox');

		if (useragent.device.type === 'mobile') {
			if (isFirefox) {
				let isIOS = !!(
					useragent.os.name?.toLowerCase().startsWith('ios') ||
					useragent.device.vendor?.toLowerCase().startsWith('apple')
				);
				shouldFlipDimensionsInPortrait = isIOS;
				shouldRequestBiggerResolutionAndCrop = !isIOS;
				logger.debug(
					`Browser was detected as Firefox. shouldFlipDimensions=${shouldFlipDimensionsInPortrait} shouldRequestBiggerResolutionAndCrop=${shouldRequestBiggerResolutionAndCrop}`
				);
			} else shouldFlipDimensionsInPortrait = true;
		} else {
			// Firefox on desktop seems to also not like adjusting the resolution to fit what's requested
			if (isFirefox) {
				shouldFlipDimensionsInPortrait = true;
			}
		}
	} else {
		logger.warn('Could not retreive useragent!');
	}
	logger.info('shouldFlipDimensions: ', shouldFlipDimensionsInPortrait);

	////////////////////////
	// Fix iOS AudioContext
	////////////////////////
	let audioContext: AudioContext;
	(function () {
		// @ts-ignore
		let AudioContextConstructor = AudioContext || webkitAudioContext;
		if (AudioContextConstructor) {
			audioContext = new AudioContextConstructor();
		}
		const fixAudioContext = function () {
			if (audioContext) {
				// Create empty buffer
				const buffer = audioContext.createBuffer(1, 1, 22050);
				const source = audioContext.createBufferSource() as AudioBufferSourceNode & {
					play?: typeof AudioBufferSourceNode.prototype.start;
					noteOn?: typeof AudioBufferSourceNode.prototype.start;
				};
				source.buffer = buffer;
				// Connect to output (speakers)
				source.connect(audioContext.destination);
				// Play sound
				if (source.start) {
					source.start(0);
				} else if (source.play) {
					source.play(0);
				} else if (source.noteOn) {
					source.noteOn(0);
				}
			}
			// Remove events
			document.removeEventListener('touchstart', fixAudioContext);
			document.removeEventListener('touchend', fixAudioContext);
		};
		// iOS 6-8
		document.addEventListener('touchstart', fixAudioContext);
		// iOS 9
		document.addEventListener('touchend', fixAudioContext);
	})();

	// For general debugging
	let debugInfo = '';

	////////////////
	// Constants
	////////////////
	const MIN_SCAN_INTERVAL = 100; // 100 ms is a pretty reasonable scan time
	const MAX_SCAN_INTERVAL = 4500; // if we don't receive a message back from the qr worker in a while
	const MIN_FOCUS_BOX_WIDTH = 200;
	const MIN_FOCUS_BOX_HEIGHT = 200;
	const snackbar = getContext('snackbar') as SnackbarContext;

	////////////////
	// Worker
	////////////////
	let worker: Worker | null = null;
	let waitingForWorker = false;

	async function initWorker() {
		worker = new Worker('/lib/wasmQrWorker.js');
		worker.onmessage = (ev) => {
			if (ev.data.data) {
				beep();
				onQrCodeData(ev.data.data, ev.data.ms);
			}
			waitingForWorker = false;
			// if (lastMessageSentTime) debugInfo = `QR scan time: ${ev.data.ms} ms, from message sent to now: ${performance.now() - lastMessageSentTime}`;
		};
	}

	////////////////
	// Elements
	////////////////
	let canvas: HTMLCanvasElement;
	let parent: HTMLElement;

	let ctx: CanvasRenderingContext2D | null;
	////////////////
	// Video
	////////////////
	const video = document.createElement('video');
	let availableWidth: number, availableHeight: number;

	/** Allow the scanner to be enabled or disabled. */
	export let enabled: boolean = true;
	let componentMounted = false;

	$: if (enabled && componentMounted) startScan();
	else stopScan();

	// Dispatcher lets us send a custom 'data' event where the qr code has been read
	const dispatch = createEventDispatcher<{data: {text: string, ms: number}}>();

	function onQrCodeData(decodedText: string, millis: number) {
		logger.trace('ONQRCODEDATA');
		dispatch('data', {
			text: decodedText,
			ms: millis
		});
	}

	let lastMessageSentTime = 0;
	let flippedDimensions = false;
	function tick() {
		const time = performance.now();
		if (!video || !ctx || !worker) return logger.error('no video or ctx or worker');
		if (video.readyState === video.HAVE_ENOUGH_DATA) {
			let { videoWidth, videoHeight } = video;

			let canvasWidth = videoWidth;
			let canvasHeight = videoHeight;
			// JL TODO: I want to improve the "crispness" of the preview box, but to do so I think I need to increase the res of the canvas
			// 	to native res. But then, using getImageData() from the same canvas will lead to Koder taking much longer to process because
			// 	of the higher resolution.
			// let canvasWidth = availableWidth;
			// let canvasHeight = availableHeight;
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;

			let smallerCanvasDimension = Math.min(canvasWidth, canvasHeight);
			let focusBoxWidth = Math.max(smallerCanvasDimension * 0.8, MIN_FOCUS_BOX_WIDTH);
			let focusBoxHeight = Math.max(smallerCanvasDimension * 0.8, MIN_FOCUS_BOX_HEIGHT);

			const sx = (canvasWidth - focusBoxWidth) / 2;
			const sy = (canvasHeight - focusBoxHeight) / 2;

			ctx.drawImage(video, 0, 0);

			// Fill canvas with semi opaque black
			ctx.fillStyle = 'black';
			ctx.globalAlpha = 0.6;
			ctx.strokeStyle = '#bbb';
			ctx.lineWidth = 5;
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);
			ctx.globalAlpha = 1;
			if ('roundRect' in ctx) ctx.roundRect(sx, sy, focusBoxWidth, focusBoxHeight, 16);
			else {
				// @ts-ignore - stupid TypeScript assumes ctx.roundRect always exists, so this else will never fall through, but it doesn't in old browser versions
				ctx.rect(sx, sy, focusBoxWidth, focusBoxHeight);
			}
			// ctx.stroke();
			ctx.clip();
			ctx.drawImage(
				video,
				sx,
				sy,
				focusBoxWidth,
				focusBoxHeight,
				sx,
				sy,
				focusBoxWidth,
				focusBoxHeight
			);
			ctx.stroke();
			// debugInfo = `Draw time: ${performance.now() - time}\n`;

			let doScan = !waitingForWorker && time - lastMessageSentTime > MIN_SCAN_INTERVAL;
			if (
				waitingForWorker &&
				lastMessageSentTime &&
				time - lastMessageSentTime > MAX_SCAN_INTERVAL
			) {
				snackbar.open(
					`WARNING: QR code WebWorker has not responded in over ${MAX_SCAN_INTERVAL} ms. Attempting again...`,
					4000
				);
				logger.warn(
					`WARNING: QR code WebWorker has not responded in over ${MAX_SCAN_INTERVAL} ms. Attempting again...`
				);
				doScan = true;
			}

			if (doScan) {
				// debugInfo += `Time since last message sent: ${time - lastMessageSentTime}`;
				lastMessageSentTime = performance.now();
				waitingForWorker = true;
				let imageData = ctx.getImageData(sx, sy, focusBoxWidth, focusBoxHeight);

				worker.postMessage({
					data: imageData.data,
					width: imageData.width,
					height: imageData.height,
					alwaysRespond: true
				});
			}
		}
		requestAnimationFrame(tick);
	}

	function stopVideoStream() {
		video!.pause();
		let srcObject = video!.srcObject as MediaStream;
		if (!srcObject) return;
		srcObject.getVideoTracks().forEach((track) => track.stop());
		video!.srcObject = null;
	}

	async function setVideoStream() {
		logger.trace('Setting video stream');
		if (!video) throw new Error('No video element');

		// Get the desired aspect ratio of the video stream to perfectly fill the remaining space on the screen
		let size = getAvailableWindowSize(parent);
		availableWidth = size.width;
		availableHeight = size.height;
		let aspectRatio = availableWidth / availableHeight;

		let videoConstraints: MediaTrackConstraints = {
			facingMode: 'environment'
		};

		const idealVideoShortSide = 640; // The resolution can vary slightly; higher resolutions are more expensive to process but if the resolution is too low, we MIGHT not be able to scan the highest-density codes
		let idealVideoWidth: number, idealVideoHeight: number;

		// Wide screens: prefer wider aspect ratio
		// TODO: (maybe) check device orientation, i.e. screen.orientation or window.orientation (latter deprecated)
		// if shouldFlipDimensionsInPortrait is true, then we are expecting
		if (aspectRatio > 1) {
			idealVideoWidth = Math.round(idealVideoShortSide * aspectRatio); // multiply by aspect ratio to get long side
			idealVideoHeight = idealVideoShortSide;
			logger.debug(`aspectRatio > 1, width=${idealVideoWidth} height=${idealVideoHeight}`);
		}
		// Phones in portrait mode that we expect to flip their vertical/horizontal resolution
		else if (shouldFlipDimensionsInPortrait) {
			idealVideoWidth = Math.round(idealVideoShortSide / aspectRatio);
			idealVideoHeight = idealVideoShortSide;
			logger.debug(
				`Phone in portrait mode where we expect to flip dimensions, width=${idealVideoWidth} height=${idealVideoHeight}`
			);
		}
		// Phones: Prefer a narrower aspect ratio, extending slightly below the nav bar to provide the illusion of a fullscreen scanner
		else {
			idealVideoWidth = idealVideoShortSide;
			idealVideoHeight = Math.round(idealVideoShortSide / aspectRatio); // divide by aspect ratio to get long side
			logger.debug(`aspectRatio <= 1, width=${idealVideoWidth} height=${idealVideoHeight}`);
		}

		videoConstraints.width = {
			ideal: idealVideoWidth,
			min: idealVideoShortSide * 0.8
		};
		videoConstraints.height = {
			ideal: idealVideoHeight,
			min: idealVideoShortSide * 0.8
		};

		let stream: MediaStream;

		logger.debug(videoConstraints);

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints
			});
		} catch (err) {
			logger.error(err);
			if (err instanceof Error && err.name === 'OverconstrainedError') {
				// If there's an OverConstrained error, try removing min/max constraints
				snackbar.open(
					'Video stream was over-constrained; attempting to re run without video stream min/max'
				);
				logger.info(
					'Attempting to re-constrain video without min/max attributes and only with ideals'
				);
				logger.debug(videoConstraints);

				delete videoConstraints.width.min;
				delete videoConstraints.height.min;

				stream = await navigator.mediaDevices.getUserMedia({
					video: videoConstraints
				});
			} else {
				snackbar.error(
					'We were unable to start the camera. Is another app already using it, or does your device not have a camera?'
				);
				throw err;
			}
		}

		video!.srcObject = stream;
		video!.setAttribute('playsinline', 'true');

		// On some devices, like my own, the requested height and width are flipped. In this case, we need to swap the width and height of the video constraints.
		// 	We should be able to request the exact height/width in this case, instead of dealing with ideal/min/max values
		video!.onloadedmetadata = async () => {
			logger.debug('Video metadata loaded', video!.videoWidth, video!.videoHeight);
			video!.play();
		};
	}

	let scanning = false,
		initScanning = false;
	async function startScan() {
		if (scanning || initScanning) return logger.debug('Already scanning; ignoring startScan()');
		initScanning = true;
		await initWorker();
		try {
			setVideoStream();
			requestAnimationFrame(tick);
			scanning = true;
		} catch (err) {
			logger.error(err);
			snackbar.error(`Could not open camera: ${err instanceof Error ? err.message : err}`);
			stopScan();
		}
		initScanning = false;
	}

	function stopScan() {
		if (!scanning) return logger.trace('Not scanning; ignoring stopVideo()');
		worker!.terminate(); // stop the worker
		stopVideoStream();
		scanning = false;
	}

	/** Play a sound */
	const beep = (freq = 650, duration = 50, vol = 10) => {
		try {
			const context = audioContext;
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.connect(gain);
			oscillator.frequency.value = freq;
			oscillator.type = 'triangle';
			gain.connect(context.destination);
			gain.gain.value = vol * 0.01;
			oscillator.start(context.currentTime);
			oscillator.stop(context.currentTime + duration * 0.001);
		} catch (e) {
			console.warn('Sorry, Web Audio API is not supported by your browser');
			console.warn(e);
		}
	};

	let ticking = false;
	function onResize() {
		if (ticking) return;
		ticking = true;
		setTimeout(async () => {
			stopVideoStream();
			await setVideoStream();
			ticking = false;
		}, 500);
	}

	////////////////
	// Component lifecycle
	////////////////

	function onVisibilityChanged() {
		if (document.hidden) stopScan();
		else startScan();
	}

	onMount(() => {
		document.addEventListener('visibilitychange', onVisibilityChanged);

		ctx = canvas.getContext('2d', {
			willReadFrequently: true
		});

		componentMounted = true;
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', onVisibilityChanged);
		stopScan();
	});
</script>

<div bind:this={parent} class="parent">
	<!-- <input type="number" bind:value={MIN_SCAN_INTERVAL} /> -->
	<!-- <div class="debug-info">{@html debugInfo}</div> -->
	<canvas id="canvas" bind:this={canvas} ></canvas>
	{#if scanning}
		<div id="wrongResolutionMsg">
			If you can see this, it means we predicted the resolution of the video stream wrong (or you're
			using Firefox). If you're not using Firefox, please send a screenshot to the Scoutradioz
			discord server with your OS version, device model, and browser.
		</div>
	{/if}
</div>

<svelte:window on:resize={onResize} />

<style lang="scss">
	// :global(body) {
	// 	overflow: hidden;
	// }
	#canvas {
		width: 100%;
		position: absolute; // to prevent scrollbar from appearing
		z-index: 1;
	}
	#wrongResolutionMsg {
		position: fixed;
		bottom: 12px;
		left: 8px;
		font-size: 0.7em;
		text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;
		color: white;
		font-weight: bold;
	}
	.debug-info {
		position: absolute;
		font-size: 0.7em;
		top: 24px;
		left: 8px;
		text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;
		color: white;
		font-weight: bold;
		z-index: 2;
	}
	.parent {
		position: relative;
	}
</style>
