<script lang="ts">
	import { getLogger } from '$lib/logger';
	import QRCode from 'qrcode';
	import type { SnackbarContext } from './types';
	import { getContext } from 'svelte';

	const snackbar = getContext('snackbar') as SnackbarContext;
	const logger = getLogger('QrCodeDisplay');

	let canvas: HTMLCanvasElement;

	export let data: string = '';

	function clearCanvas() {
		let ctx = canvas.getContext('2d');
		ctx?.clearRect(0, 0, canvas.width, canvas.height);
	}

	// When data changes, change the QR code
	$: if (canvas && data) {
		logger.debug('Generating QR code...');
		QRCode.toCanvas(
			canvas,
			data,
			{
				errorCorrectionLevel: 'medium'
			},
			(err) => {
				if (err) {
					logger.debug(String(err));
					logger.debug('Attempting to generate QR code with lower error correction level');
					QRCode.toCanvas(
						canvas,
						data,
						{
							errorCorrectionLevel: 'low'
						},
						(err) => {
							if (err) {
								snackbar.error(String(err));
								clearCanvas();
							}
						}
					);
				}
			}
		);
	}
	$: if (canvas && !data) {
		logger.debug('Data is not present or was removed; clearing canvas');
		clearCanvas();
	}
</script>

<div class="canvas-parent">
	<canvas bind:this={canvas} />
</div>

<style lang="scss">
	.canvas-parent {
		max-width: 100vw;
		margin: auto;
	}
	canvas {
		// i'll do something more fancy later
		max-width: 100%;
		aspect-ratio: 1;
		height: unset !important; // override height set by QRCode
	}
</style>
