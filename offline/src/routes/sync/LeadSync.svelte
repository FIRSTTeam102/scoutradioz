<script lang='ts'>
	import Paper from '@smui/paper';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';
	import x from 'zlib';
	
	let canvas: HTMLCanvasElement;
	
	onMount(() => {
		QRCode.toCanvas(canvas, 'laofdjadsklvcja dslkfja ldksfjasdlfkjha sdlkjfha dslkfjha sldkjfha lsdkjfha lksdjfh alsdkjfh alsdkjhf asdlkjfhalskdjhfalksdjhfaldksjfh alksdjhflkajh ajdflkajs dfklaj dsklfja dktslfjlakdshflakdjhflkjahdsflkjahdflkjahdsfljah dsflkjahds flkjahdlfkjhadslkfjhadflkjhadlfbjhadlfkjhadblskfjhabdlskjfhalbdjhfalbdjshflbadjshflbkadsjhflbajkdhfbljashdfjbahsdjkfhadsjhfjkasdhfjkdhsjkfhadkjfha jdskhf kjahds jfk hkdjshf kjah laofdjadsklvcja dslkfja ldksfjasdlfkjha sdlkjfha dslkfjha sldkjfha lsdkjfha lksdjfh alsdkjfh alsdkjhf asdlkjfhalskdjhfalksdjhfaldksjfh alksdjhflkajh ajdflkajs dfklaj dsklfja dktslfjlakdshflakdjhflkjahdsflkjahdflkjahdsfljah dsflkjahds flkjahdlfkjhadslkfjhadflkjhadlfbjhadlfkjhadblskfjhabdlskjfhalbdjhfalbdjshflbadjshflbkadsjhflbajkdhfbljashdfjbahsdjkfhadsjhfjkasdhfjkdhsjkfhadkjfha jdskhf kjahds jfk hkdjshf kjah laofdjadsklvcja dslkfja ldksfjasdlfkjha sdlkjfha dslkfjha sldkjfha lsdkjfha lksdjfh alsdkjfh alsdkjhf asdlkjfhalskdjhfalksdjhfaldksjfh alksdjhflkajh ajdflkajs dfklaj dsklfja dktslfjlakdshflakdjhflkjahdsflkjahdflkjahdsfljah dsflkjahds flkjahdlfkjhadslkfjhadflkjhadlfbjhadlfkjhadblskfjhabdlskjfhalbdjhfalbdjshflbadjshflbkadsjhflbajkdhfbljashdfjbahsdjkfhadsjhfjkasdhfjkdhsjkfhadkjfha jdskhf kjahds jfk hkdjshf kjah laofdjadsklvcja dslkfja ldksfjasdlfkjha sdlkjfha dslkfjha sldkjfha lsdkjfha lksdjfh alsdkjfh alsdkjhf asdlkjfhalskdjhfalksdjhfaldksjfh alksdjhflkajh ajdflkajs dfklaj dsklfja dktslfjlakdshflakdjhflkjahdsflkjahdflkjahdsfljah dsflkjahds flkjahdlfkjhadslkfjhadflkjhadlfbjhadlfkjhadblskfjhabdlskjfhalbdjhfalbdjshflbadjshflbkadsjhflbajkdhfbljashdfjbahsdjkfhadsjhfjkasdhfjkdhsjkfhadkjfha jdskhf kjahds jfk hkdjshf kjah image.pngimage.png', {
			errorCorrectionLevel: 'low'
		}, function (err) {
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