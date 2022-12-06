<div class='header-bar' bind:this={headerBar} bind:clientHeight={headerbarHeight}>
	<TopAppBar bind:this={topAppBar} variant="static" dense>
		<Row>
		  <Section>
			<IconButton class="material-icons">menu</IconButton>
			<!-- <Title>Standard</Title> -->
			<a href='/' class='header-logo'>
				<img src='/images/brand-logos/scoutradioz-white-sm.png' alt='Scoutradioz logo' class='header-logo-img'/>
			</a>
			<div class='my-header'></div>
		  </Section>
		  <Section align="end" toolbar>
			<IconButton class="material-icons" aria-label="Download"
			  >sync</IconButton
			>
			<IconButton class="material-icons" aria-label="Print this page"
			  >language</IconButton
			>
			<IconButton class="material-icons" aria-label="Bookmark this page"
			  >share</IconButton
			>
		  </Section>
		</Row>
	</TopAppBar>
</div>
<div class='content-container'>
	<slot></slot>
</div>

<script lang="ts">
	import TopAppBar, {
		Row,
		Section,
		Title,
		AutoAdjust,
	} from '@smui/top-app-bar';
	import IconButton from '@smui/icon-button';
	import LoremIpsum from '$lib/LoremIpsum.svelte';

	let topAppBar: TopAppBar;
	let headerBar: HTMLDivElement;
	let headerbarHeight: number = NaN; // Height of the header bar
	
	let lastScrollTop = 0
	
	function onScroll() {
		// we want to keep as little code as possible in here for performance reasons
		// so anything that persists should be declared outside of it
		
		let scrollTop = window.scrollY;
		
		// only update if there was enough of a change
		if (Math.abs(lastScrollTop - scrollTop) <= headerbarHeight) return;
		
		// Scrolled down, hide
		if (scrollTop > lastScrollTop) headerBar.classList.add('hidden');
		// Scrolled up, show
		else headerBar.classList.remove('hidden');
			
		// lastScrollTop will only update in blocks of headerbarHeight since it's after the return
		lastScrollTop = scrollTop;
		// https://github.com/FIRSTTeam102/ScoringApp-Serverless/commit/804284b5ef83b8d58c75435828dfe33c76f8c57e
	}
</script>

<svelte:window on:scroll={onScroll}></svelte:window>

<style lang='scss'>
	$header-height: 48px;
	.header-bar {
		position: fixed;
		width: 100%;
		top: 0px;
		transition: top .15s ease-out;
		&:global(.hidden) {
			top: -$header-height;
		}
	}
	:global(.mdc-top-app-bar) {
		top: 0px;
		// transition: top .15s ease-in-out, box-shadow 200ms linear!important; // todo anim vars
	}
	.content-container {
		padding-top: $header-height;
	}
	.header-logo {
		height: $header-height;
		display: block;
		padding: 6px;
		box-sizing: border-box;
	}
	.header-logo-img{
		max-height: 100%; 
		max-width: 100%;
		vertical-align: middle;
		padding-left: 8px;
	}
</style>
  
  <!-- <style>
	/* Hide everything above this component. */
	:global(#smui-app),
	:global(body),
	:global(html) {
	  display: block !important;
	  height: auto !important;
	  width: auto !important;
	  position: static !important;
	}
  </style> -->
  