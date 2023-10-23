<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import SimpleSnackbar from './SimpleSnackbar.svelte';
	import { getAvailableWindowSize } from './utils';
	
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

	////////////////
	// Worker
	////////////////
	let worker: Worker | null = null;
	
	async function initWorker() {
		worker = new Worker('/lib/wasmQrWorker.js');
		worker.onmessage = (ev) => {
			beep();
			onQrCodeData(ev.data.data, ev.data.ms);
		};
	}

	////////////////
	// Constants
	////////////////
	const SCAN_FREQUENCY = 2; // scans per second
	const SCAN_INTERVAL_MS = 1000 / SCAN_FREQUENCY; // ms between scans
	const MIN_FOCUS_BOX_WIDTH = 200;
	const MIN_FOCUS_BOX_HEIGHT = 200;
	
	////////////////
	// Elements
	////////////////
	let canvas: HTMLCanvasElement;
	let snackbar: SimpleSnackbar;
	let parent: HTMLElement;
	
	let ctx: CanvasRenderingContext2D | null;
	////////////////
	// Video
	////////////////
	const video = document.createElement('video');
	
	/** Allow the scanner to be enabled or disabled. */
	export let enabled: boolean = true;
	
	$: if (enabled) startScan();
	else stopScan();
	
	function onVisibilityChanged() {
		if (document.hidden)
			stopScan();
		else
			startScan();
	}
	
	// Dispatcher lets us send a custom 'data' event where the qr code has been read
	const dispatch = createEventDispatcher();
	
	function onQrCodeData(decodedText: string, millis: number) {
		console.log('ONQRCODEDATA');
		dispatch('data', {
			text: decodedText,
			ms: millis,
		});
	}

	let lastMessageTime = 0;
	function tick(time: number) {
		if (!video || !ctx || !worker) return console.log('no video or ctx or worker');
		if (video.readyState === video.HAVE_ENOUGH_DATA) {
			
			let canvasWidth = video.videoWidth;
			let canvasHeight = video.videoHeight;
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;
			
			let smallerCanvasDimension = Math.min(canvasWidth, canvasHeight);
			let focusBoxWidth = Math.max(smallerCanvasDimension * 0.8, MIN_FOCUS_BOX_WIDTH);
			let focusBoxHeight = Math.max(smallerCanvasDimension * 0.8, MIN_FOCUS_BOX_HEIGHT);

			const sx = (canvasWidth - focusBoxWidth) / 2;
			const sy = (canvasHeight - focusBoxHeight) / 2;

			ctx.drawImage(video, 0, 0);
			
			ctx.fillStyle = 'black';
			ctx.globalAlpha = 0.6;
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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

			if (time - lastMessageTime > SCAN_INTERVAL_MS) {
				lastMessageTime = time;
				let imageData = ctx.getImageData(sx, sy, focusBoxWidth, focusBoxHeight);
				
				worker.postMessage({
					data: imageData.data,
					width: imageData.width,
					height: imageData.height
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
		console.log('Setting video stream');
		if (!video) throw new Error('No video element');
		
		// Get the desired aspect ratio of the video stream to perfectly fill the remaining space on the screen
		let { width, height } = getAvailableWindowSize(parent);
		let aspectRatio = width / height;
		
		let videoConstraints: MediaTrackConstraints = {
			facingMode: 'environment',
			// deviceId: '3dada17451a1d1c171c0c2d48d3e6b571819d3c55f533f5271d1e886633983b5', // JL: For testing only (this is my OBS virtual camera)
			aspectRatio: {
				ideal: aspectRatio,
			}
		}
		
		const idealVideoWidth = 720; // The resolution can vary slightly; higher resolutions are more expensive to process but if the resolution is too low, we MIGHT not be able to scan the highest-density codes
		let idealVideoHeight = Math.round(idealVideoWidth / aspectRatio);
		// Wide screens: Prefer a wider aspect ratio
		if (aspectRatio > 1) {
			videoConstraints.width = {
				ideal: idealVideoWidth,
				min: idealVideoWidth,
			};
			videoConstraints.height = {
				ideal: idealVideoHeight,
			};
		}
		// Phones: Prefer a narrower aspect ratio, extending slightly below the nav bar to provide the illusion of a fullscreen scanner
		else {
			videoConstraints.width = {
				ideal: idealVideoWidth,
			};
			videoConstraints.height = {
				ideal: idealVideoHeight,
				min: idealVideoHeight,
			};
		}
		
		let stream: MediaStream;
		
		console.log(videoConstraints);
		
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
			});
		}
		// If there's an OverConstrained error, try removing min/max constraints
		catch (err) {
			console.error(err);
			console.log('Attempting to re-constrain video without min/max attributes and only with ideals');
			console.log(videoConstraints);
		
			delete videoConstraints.width.min;
			delete videoConstraints.width.max;
			delete videoConstraints.height.min;
			delete videoConstraints.height.max;
			
			stream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
			});
		}
			
		video!.srcObject = stream;
		video!.setAttribute('playsinline', 'true');
		
		// On some devices, like my own, the requested height and width are flipped. In this case, we need to swap the width and height of the video constraints.
		// 	We should be able to request the exact height/width in this case, instead of dealing with ideal/min/max values
		video!.onloadedmetadata = async () => {
			console.log('Video metadata loaded', video!.videoWidth, video!.videoHeight);
			
			// Detect whether the height and width values have been swapped by calculating the distance between video.videoWidth and videoConstraints.width.ideal and between video.videoHeight and videoConstraints.height.ideal
			let widthDistance = Math.abs(video!.videoWidth - idealVideoWidth);
			let heightDistance = Math.abs(video!.videoHeight - idealVideoHeight);
			let distance = widthDistance + heightDistance;
			let widthDistanceSwapped = Math.abs(video!.videoWidth - idealVideoHeight);
			let heightDistanceSwapped = Math.abs(video!.videoHeight - idealVideoWidth);
			let distanceSwapped = widthDistanceSwapped + heightDistanceSwapped;
			
			// This means that the height and width values have been swapped, because if they were not, the distance between the ideal values and the actual values would be the same or very small
			if (distanceSwapped < distance) {
				console.log('Video height and width have been swapped. Re-constraining video stream with swapped values.');
				
				let newVideoConstraints: MediaTrackConstraints = {
					// Since the width and height will be flipped again, just request new width = old width and new height = old height,
					//  then the browser will automatically flip to what we actually want
					width: video!.videoWidth, 
					height: video!.videoHeight,
				};
				
				const track = stream.getVideoTracks()[0];
				if (!track) throw new Error('No video track!!');
				
				await track.applyConstraints(newVideoConstraints);
				
				snackbar.open('Your device flipped video stream width and height. Please let the devs know if you see this message just so we know. This message will be removed in the future.');
			}
			
			video!.play();
		}
	}

	let scanning = false, initScanning = false;
	async function startScan() {
		if (scanning || initScanning) return console.log('Already scanning; ignoring startVideo()');
		initScanning = true;
		console.log(video); // temporary for debugging
		await initWorker();
		try {
			setVideoStream();
			requestAnimationFrame(tick);
			scanning = true;
		}
		catch (err) {
			console.log(err);
			snackbar.error(`Could not open camera: ${err instanceof Error ? err.message : err}`)
			stopScan();
		}
		initScanning = false;
	}

	function stopScan() {
		if (!scanning) return console.log('Not scanning; ignoring stopVideo()');
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
	onMount(() => {
		document.addEventListener('visibilitychange', onVisibilityChanged);
		
		ctx = canvas.getContext('2d');
		
		if (!document.hidden)
			startScan();
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', onVisibilityChanged);
		stopScan();
	});
</script>

<div bind:this={parent}>
	<canvas id="canvas" bind:this={canvas} />
</div>
<SimpleSnackbar bind:this={snackbar} />

<svelte:window on:resize={onResize} />

<svelte:body style='overflow: hidden;' />

<style>
	body {
		overflow: hidden;
	}
	#canvas {
		width: 100%;
	}
</style>
