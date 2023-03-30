<script lang="ts">
	import type { PageData } from './$types';
	// import LayoutGrid, { Cell } from '@smui/layout-grid';
	import Card, { Content as CContent } from '@smui/card';
	import List, { Item, Text, PrimaryText, SecondaryText, Meta } from '@smui/list';
	import Button, { Label as BLabel, Icon as BIcon } from '@smui/button';
	import { userName } from '$lib/stores';

	export let data: PageData;

	const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true
	});
</script>

<h1>Match scouting</h1>

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
						<Item class={asg.alliance} selected={asg.assigned_scorer === $userName}>
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

		:global {
			$red: color-palette.$red-900;
			$blue: color-palette.$blue-900;

			.mdc-deprecated-list-item--selected {
				@include theme.property(--mdc-theme-primary, on-primary);
				border-radius: mdc-shape.$small-component-radius;
			}

			.red {
				&.mdc-deprecated-list-item--selected {
					background: transparentize($red, 0.9);
				}
				.mdc-button {
					@include mdc-button.filled-accessible($red);
				}
			}
			.blue {
				&.mdc-deprecated-list-item--selected {
					--mdc-theme-primary: $blue;
					background: transparentize($blue, 0.9);
				}
				.mdc-button {
					@include mdc-button.filled-accessible($blue);
				}
			}
		}
	}
</style>
