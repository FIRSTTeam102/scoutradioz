<script lang="ts">
	import Button from '@smui/button';
	import Dialog, {
		Title as DTitle,
		Content as DContent,
		Actions as DActions,
	} from '@smui/dialog';
	import Autocomplete from '@smui-extra/autocomplete';
	import Paper from '@smui/paper';
	import type { Org } from 'scoutradioz-types';
	let { data } = $props();

	let orgs = $state(data.orgs) as Org[];
	let signedInOrgKey = data.originalOrgKey as string|undefined;
	let signedInUser = data.originalUser as string|undefined;
	let socialUser = data.socialUser as any|undefined;
	
	let signedInOrg = orgs.find(org => org.org_key === signedInOrgKey);

	const getOrgOptionLabel = (org: Org) => {
		if (!org) return '';
		if (org.team_numbers)
			return org.team_numbers.join(' & ') + ' - ' + org.nickname;
		if (org.team_number) return org.team_number + ' - ' + org.nickname;
		return org.nickname;
	};

	function logInToOrg() {
		if (!org) return;
		Cookies.set('picked_org', org?.org_key);
		location.href = '/user/login';
	}

	function viewOrg() {
		if (!org) return;
		Cookies.set('picked_org', org.org_key);
		location.href = '/home';
	}

	const msg = (str: string) => str; // Placeholder for localization function

	let org: Org | null = $state(null);
	let learnMoreOpen = $state(false);
</script>

<div class="w3-auto">
	<h1>Choose an organization</h1>
	<Autocomplete
		textfield$variant="filled"
		textfield$style="width: 100%"
		style="width: 100%"
		options={orgs}
		disabled={!orgs}
		getOptionLabel={getOrgOptionLabel}
		bind:value={org}
		label={'Type-Ahead Search'}
	/>
	<div class="w3-grid w3-margin-top" style="grid: auto / 1fr 1fr; gap: 1em">
		<Button disabled={!org} onclick={logInToOrg} variant="unelevated"
			>Log in to the org</Button
		>
		<Button disabled={!org} onclick={viewOrg} variant="unelevated"
			>Just see the data</Button
		>
	</div>
	{#if signedInOrg}
		<Paper class="w3-margin-top">
			<i>You are signed in to {signedInOrg.nickname} as {signedInUser}.</i>
			<Button href='/home' class='w3-show-inline'>Return to {signedInOrg.nickname}</Button>
		</Paper>
	{/if}
	{#if !signedInOrg && socialUser}
	<Paper class="w3-margin-top">
		<i>To link social login {socialUser.name} to a Scoutradioz account, log in above!</i>
	</Paper>
	{/if}
	{#if socialUser}
	<hr />
	<h2>Log out of social</h2>
	<Button variant="unelevated" href="/user/logout/social"
		>Sign out as {socialUser.name}</Button
	>
	{/if}
	{#if !socialUser && !signedInOrg}
	<hr />
	<h2>Log in via social</h2> 
	<Button variant="unelevated" href="/user/social/login"
		>Sign in with a social connection</Button
	>
	{/if}
	<hr />
	<h2>See what data is available</h2>
	<Button variant="unelevated" href="/browse">Browse all current events</Button>
	<hr />
	<Paper class="w3-grid" style="grid: auto / 1fr 1fr; gap: 1em">
		<Button href="https://wiki.team102.org/scoutradioz/what_is_scoutradioz"
			>Learn more about Scoutradioz</Button
		>
		<Button href="https://docs.google.com/forms/d/e/1FAIpQLSfIugRLrny7-3k0nwgtUs2Vsr5jyMRlMojNgRMYVHdTZX1PiA/viewform"
			>Sign up your team!</Button
		>
	</Paper>
	<!-- 
	<Button href="">Sign up your team</Button> -->
</div>
<!-- <Dialog bind:open={learnMoreOpen}>
	<DTitle id="popup-title">Learn more about Scoutradioz</DTitle>
	<DContent id="popup-content">
		<div class="w3-padding-small">
			<p>
				<span class="sprite sp-16 sp-radio sp-inline"></span>
				<span>{msg('index.info.intro')}</span>
			</p>
			<p>{@html msg('index.info.features.intro')}</p>
			<ul>
				<li class="w3-margin">{@html msg('index.info.features.modular')}</li>
				<li class="w3-margin">{@html msg('index.info.features.automatic')}</li>
				<li class="w3-margin">{@html msg('index.info.features.advanced')}</li>
				<li class="w3-margin">{@html msg('index.info.features.management')}</li>
				<li class="w3-margin">{@html msg('index.info.features.free')}</li>
			</ul>
			<div class="w3-center w3-margin-top">
				<a
					class="theme-link w3-btn gear-btn"
					href="https://forms.gle/vRqkS5w4HpKNdLYp9"
					target="_blank"
				>
					<span class="sprite sp-22 sp-black sp-org sp-inline"></span>
					<span>{@html msg('index.info.signup')}</span>
				</a>
			</div>
			<div class="w3-center w3-margin-top">
				<a
					class="theme-link w3-btn gear-btn"
					href="https://wiki.team102.org/scoutradioz/start"
					target="_blank"
				>
					<span class="sprite sp-22 sp-black sp-info sp-inline"></span>
					<span>{@html msg('index.info.wiki')}</span>
				</a>
			</div>
			<div class="w3-center w3-margin-top" id="discordLink">
				<a
					class="theme-link w3-btn gear-btn"
					href="https://discord.gg/hUsbWTeEVz"
					target="_blank"
				>
					<span class="sprite sp-22 sp-black sp-discord sp-inline"></span>
					<span>{@html msg('index.info.discord')}</span>
				</a>
			</div>
			<div class="w3-center w3-margin-top">
				<a
					class="theme-link w3-btn gear-btn"
					href="https://github.com/FIRSTTeam102/scoutradioz/"
					target="_blank"
				>
					<span class="sprite sp-22 sp-black sp-github sp-inline"></span>
					<span>{@html msg('index.info.github')}</span>
				</a>
			</div>
			<br />
			<div class="w3-center w3-margin-top">
				<a
					class="theme-link w3-btn gear-btn"
					href="https://www.firstinspires.org/robotics/frc"
					target="_blank"
				>
					<span class="sprite sp-22 sp-black sp-first sp-inline"></span>
					<span>{msg('index.info.first')}</span>
				</a>
			</div>
		</div>
	</DContent>

	<DActions>
		<Button>Close</Button>
	</DActions>
</Dialog> -->
