<script lang="ts">
	import { onMount } from 'svelte';

	import type { LayoutServerData, PageServerData } from './$types';

	function msg(text: string) {
		return text;
	}

	function selectLanguage() { }

	const backgrounds = {
		2020: 'city-light.png',
		2022: '2022-grid.svg',
		2023: '2023-halftone.svg'
	};

	let themeYear: keyof typeof backgrounds = 2023;
	let darkLogo = [2020].includes(themeYear);

	export let data: LayoutServerData;

	// Code within onMount() only runs client-side, I believe.
	// 	Stuff outside these hooks might run server-side during SSR.
	onMount(() => {
		if (data.alert) {
			// Remove "alert", "type", and "autofade" from the URL queries.
			const url = new URL(location.href);
			url.searchParams.delete('alert');
			url.searchParams.delete('type');
			url.searchParams.delete('autofade');

			history.replaceState({}, document.title, url);

			// Show the alert (TODO NotificationCard)
			alert(data.alert);
		}
	});
</script>

<div id="page" style="--background-image: url('images/backgrounds/{backgrounds[themeYear]}')">
	<div id="headerbar" class="w3-card header tier-{data.TIER}">
		<div class="header-left">
			<a id="burger">
				<button class="mburger mburger--squeeze" title={msg('layout.menu.main')}>
					<b />
					<b />
					<b />
				</button>
			</a>
			<div>
				<span style="display:inline-block;height:100%;vertical-align:middle;" />
				<a href="/home">
					<img
						src="/images/brand-logos/scoutradioz-{darkLogo ? 'black' : 'white'}-sm.png"
						class="header-logo"
						alt="Scoutradioz"
					/>
				</a>
			</div>
			{#if ['dev', 'test', 'qa'].includes(String(data.TIER))}
				<div class="tierlabel">{data.TIER}</div>
			{/if}
		</div>
		<div class="header-right">
			<div on:click={selectLanguage} on:keypress={selectLanguage} class="centered clickable" title="Language">
				<span class="sprite sp-32 sp-i18n" />
			</div>
		</div>
	</div>

	<slot />
</div>
