<script lang='ts'>
	import Paper from '@smui/paper';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';
	import x from 'zlib';
	
	let canvas: HTMLCanvasElement;
	
	onMount(() => {
		QRCode.toCanvas(canvas, 'laofdjadsklvcja dslkfja ldksfjasdlfkjha sdlkjfha dslkfjha sldkjfha lsdkjfha lksdjfh alsdkjfh alsdkjhf asdlkjfhalskdjhfalksdjhfaldksjfh alksdjhflkajh', function (err) {
			if (err) console.error(err);
			else console.log('success');
		})
	});
</script>

<Paper>
	This is the Scouting Lead Sync page!
</Paper>

<canvas bind:this={canvas}/>

<style lang='scss'>
	canvas {
		// i'll do something more fancy later
		margin: auto;
		display: block;
	}
</style>