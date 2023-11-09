<script lang="ts">
	import type { PageData } from './$types';
	// import LayoutGrid, { Cell } from '@smui/layout-grid';
	import Card, { Content as CContent } from '@smui/card';
	import List, { Item, Text, PrimaryText, SecondaryText, Meta } from '@smui/list';
	import Button, { Label as BLabel, Icon as BIcon } from '@smui/button';
	import { event_key, userName } from '$lib/stores';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	export let data: PageData;

	const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true
	});
	
</script>

<h1>Match scouting</h1>
<!-- JL: yes this is hacky as HECK but i only have a few minutes to throw this together -->
<p>
	Current match number: {data.firstMatchNumber}
	<Button on:click={() => {
		let newMatchNumber = Math.max(data.firstMatchNumber - 1, 1);
		localStorage.setItem(`match_number_${$event_key}`, String(newMatchNumber));
		invalidateAll();
	}}>
		<BLabel>Decrease</BLabel>
	</Button>
	<Button on:click={() => {
		let newMatchNumber = data.firstMatchNumber + 1;
		localStorage.setItem(`match_number_${$event_key}`, String(newMatchNumber));
		invalidateAll();
	}}>
		<BLabel>Increase</BLabel>
	</Button>
</p>

<div class="cards">
	{#each data.grouped as group}
		<Card>
			<CContent>
				<div class="head">
					<h3>Match {group[0].match_number}</h3>
					<span>{dateTimeFormat.format(group[0].time * 1000)}</span>
				</div>
				<List twoLine nonInteractive>
					{#each group as asg}
						<Item
							class={(asg.data && asg.synced
								? 'complete-and-synced '
								: asg.data && !asg.synced
								? 'complete-locally '
								: 'incomplete ') + asg.alliance}
							selected={asg.assigned_scorer === $userName}
						>
							<Text>
								<PrimaryText>Team {asg.team_key.replace('frc', '')}: {asg.team_name}</PrimaryText>
								<SecondaryText>Assigned to: {asg.assigned_scorer?.name}</SecondaryText>
							</Text>
							<Meta>
								<Button href={`/scouting/match/form?key=${asg.match_team_key}`}>
									<BLabel>Scout</BLabel>
									<i class="material-icons" aria-hidden="true">arrow_forward</i>
								</Button>
							</Meta>
						</Item>
					{/each}
				</List>
			</CContent>
		</Card>
	{/each}
</div>

<style lang="scss">
	@use '@material/button/index' as mdc-button;
	@use '@material/theme/color-palette';
	@use '@material/shape' as mdc-shape;
	@use '@material/theme';
	@use '../../../lib/cards.scss' as cards;

	.cards {
		@include cards.container;

		.head {
			text-align: center;
		}

		h3 {
			margin: 0;
		}
	}
	:global(.cards) {
		$red: color-palette.$red-900;
		$blue: color-palette.$blue-900;
		$grey: color-palette.$grey-700;

		:global(.mdc-deprecated-list-item--selected) {
			@include theme.property(--mdc-theme-primary, on-primary);
			border-radius: mdc-shape.$small-component-radius;
		}

		:global(.red.incomplete) {
			:global(&.mdc-deprecated-list-item--selected) {
				background: transparentize($red, 0.9);
			}
			:global(.mdc-button) {
				@include mdc-button.filled-accessible($red);
			}
		}
		:global(.blue.incomplete) {
			:global(&.mdc-deprecated-list-item--selected) {
				--mdc-theme-primary: $blue;
				background: transparentize($blue, 0.9);
			}
			:global(.mdc-button) {
				@include mdc-button.filled-accessible($blue);
			}
		}
		// JL note: not perfect, definitely wanna redo the styling, but it gets the idea across and it's really late
		:global(.red.complete-locally) {
			:global(.mdc-button) {
				@include mdc-button.ink-color($red);
				@include mdc-button.outline-color($red);
				@include mdc-button.filled-accessible(mix($red, $grey, 20%));
				border-style: dashed;
				border-width: 2px;
			}
		}
		:global(.blue.complete-locally) {
			:global(.mdc-button) {
				@include mdc-button.ink-color($blue);
				@include mdc-button.outline-color($blue);
				@include mdc-button.filled-accessible(mix($blue, $grey, 20%));
				border-style: dashed;
				border-width: 2px;
			}
		}
		:global(.complete-and-synced) {
			:global(.mdc-button) {
				@include mdc-button.filled-accessible($grey);
			}
		}
	}
</style>
