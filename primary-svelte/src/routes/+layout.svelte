
<script lang='ts'>
	
	import { env } from '$env/dynamic/private';
	
	function msg(text: string) {
		return text;
	}
	
	function selectLanguage() {
		
	}
	
	const backgrounds = {
		2020: 'city-light.png',
		2022: '2022-grid.svg',
		2023: '2023-halftone.svg',
	};
	
	let themeYear: keyof typeof backgrounds = 2023;
	let darkLogo = [2020].includes(themeYear);
	
	// TODO: if alert && alert != "undefined"
	
</script>

<div id="page" style="--background-image: url('images/backgrounds/{backgrounds[themeYear]}')">
	
	<div id="headerbar" class="w3-card header tier-{env.TIER}">
		<div class="header-left">
			<a id="burger">
				<button class="mburger mburger--squeeze" title={msg('layout.menu.main')}>
					<b/>
					<b/>
					<b/>
				</button>
			</a>
			<div>
				<span style="display:inline-block;height:100%;vertical-align:middle;"/>
				<a href="/home">
					<img src="/images/brand-logos/scoutradioz-{darkLogo ? 'black' : 'white'}-sm.png" class="header-logo" alt="Scoutradioz">
				</a>
			</div>
			{#if ['dev', 'test', 'qa'].includes(String(env.TIER))}
				<div class="tierlabel">{env.TIER}</div>
			{/if}
		</div>
		<div class="header-right">
			<a href="javascript:selectLanguage()" class="centered" title="Language">
				<span class="sprite sp-32 sp-i18n"/>
			</a>
		</div>
	</div>
	
	<slot/>
</div>