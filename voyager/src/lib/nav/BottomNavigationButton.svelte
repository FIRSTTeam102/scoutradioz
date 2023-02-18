<script lang="ts">
	import Ripple from '@smui/ripple';
	
	export let href = '#';
	export let label: string;
	export let icon: string;
	export let style = '';
	export let onClick: () => void = () => {};
</script>

<a
	href={href}
	use:Ripple={{surface: true}}
	on:click={onClick}
	tabindex="0"
	class="bottom-nav-button"
	style={style}
>
	<div class="material-icons icon">{icon}</div>
	<span class="label">{label}</span>
</a>

<style lang='scss'>
	.bottom-nav-button {
		margin: -12px 8px;
		font-size: 0.875rem;
		display: grid;
		grid-template-columns: auto auto;
		place-items: center;
		column-gap: 8px;
		border-radius: var(--mdc-shape-small, 4px);
	}
	// On wide screns, force the label and icons to squish together
	@media(min-width: 601px) {
		.label {
			justify-self: flex-start;
		}
		.icon {
			justify-self: flex-end;
		}
	}
	@media(max-width: 600px) {
		.bottom-nav-button {
			display: grid;
			grid-template-columns: auto;
		}
	}
	@media(max-width: 400px) {
		.label {
			display: none;
		}
	}
	a, a:visited {
		color: inherit;
		text-decoration: inherit;
	}
</style>