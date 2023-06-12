<script lang='ts'>
	import { msg, msgMarked } from "$lib/i18n-placeholder";
	import { page } from '$app/stores';
	
	//- this seems like the prettiest way to write it
	//- html-like syntax can be used in the json to create the link ({github}text{/github})
	const github = {
		'github': '<span class="sprite sp-18 sp-inline sp-github">&nbsp;</span><a class="link" href="https://github.com/FIRSTTeam102/ScoringApp-Serverless/issues" target="_blank">',
		'/github': '</a>'
	}
</script>

<svelte:head>
	<base href="/"/>
</svelte:head>

<template lang="pug">
	div(id="errorContents")
		//- h2.i {msg('error.title', {message: $page.error.message})}
		//- temporary until i18n
		
		h2.i Error: {$page.error.message}
		h6 {$page.status} {$page.error.statusMessage || $page.error?.message}
		//- 2022-04-04 JL: Don't show the wordy message on Not Found errors
		+if('$page.status != 404 && !$page.error.disableStackTrace')
			div(class="w3-left-align w3-margin-left")
				div.w3-large
					p
						span(class="sprite sp-18 sp-inline sp-scoutradioz") &nbsp;
						span {msg('error.report.intro')}
					ol
						li {msg('error.report.screenshot')}
						li {msg('error.report.url')}
						li {msgMarked('error.report.send', github)}
				+if('$page.error?.stack')
					p.w3-large {msg('error.stack')}
					pre(class="" style="text-shadow: 1px 1px 2px #000000") {$page.error?.stack}
</template>