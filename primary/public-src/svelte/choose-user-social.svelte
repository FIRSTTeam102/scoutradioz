<script lang="ts">
	import Button from '@smui/button';
	import Dialog, {
		Title as DTitle,
		Content as DContent,
		Actions as DActions,
	} from '@smui/dialog';
	import Paper from '@smui/paper';
    import { unsubscribe } from 'diagnostics_channel';
	import type { User } from 'scoutradioz-types';
	let { data } = $props();

	let users = $state(data.users) as User[];

	const getUserOptionLabel = (user: User) => {
		if (!user) return '';
		return user.org_key + ' - ' + user.name;
	};

	const msg = (str: string) => str; // Placeholder for localization function

	let user: User | null = $state(null);
	let learnMoreOpen = $state(false);

	// Function to handle the click event
	function handleClick(buttonLabel: string) {
    	alert(`Clicked: ${buttonLabel}`);
	}
</script>

<div class="w3-auto">
	<h1>Choose a user</h1>
	{#each users as u (u._id)}
		<div class="w3-grid w3-margin-top" style="grid: auto / 1fr 1fr; gap: 1em">
			<Button on:click={() => handleClick(u._id)}
				>{u.org_key + ' - ' + u.name}</Button
			>
		</div>
	{/each}
	<hr />
	<h2>See what data is available</h2>
	<Button variant="unelevated" href="/browse">Browse all current events</Button>
	<!-- <hr />
	<Button onclick={() => (learnMoreOpen = true)}
		>Learn more about Scoutradioz</Button
	>
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
