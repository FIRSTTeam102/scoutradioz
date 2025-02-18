<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import Ripple from '@smui/ripple';
	
	interface Props {
		href?: string;
		label: string;
		icon: string;
		style?: string;
		onClick?: () => void;
	}

	let {
		href = '#',
		label,
		icon,
		style = '',
		onClick = () => {}
	}: Props = $props();
	
	// The menu button is a bit of an oddball, since its href is "#" and we probably want to make that one visible always
	let selected = ($state(href.startsWith('#') || location.pathname.startsWith(href)));
	afterNavigate(() => {
		selected = (href.startsWith('#') || location.pathname.startsWith(href));
	});
</script>

<a
	href={href}
	use:Ripple={{surface: true}}
	onclick={onClick}
	tabindex="0"
	class="bottom-nav-button"
	style={style}
	class:unselected={!selected}
>
	<div class="material-icons icon">{icon}</div>
	<span class="label">{label}</span>
</a>

<style lang='scss'>
	.unselected {
		opacity: 60%;
	}
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