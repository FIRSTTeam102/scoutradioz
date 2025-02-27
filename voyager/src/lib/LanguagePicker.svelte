<script lang="ts">
	import Dialog, { Title, Content, Actions } from '@smui/dialog';
	import Button, { Label } from '@smui/button';
	import List, { Item, Text } from '@smui/list';
	import { i18n, msg } from './i18n';
	import Cookies from 'js-cookie';

	let dlgOpen = false;

	let locales = i18n.getLocales();
	let currentLang = document.documentElement.lang || 'en';
	let langNames = new Intl.DisplayNames([currentLang], { type: 'language' });

	let localePickerItems = locales.map((locale) => {
		return {
			label: `${langNames.of(locale.lang)} (${locale.name})`,
			locale: locale.lang
		};
	});

	export function open() {
		dlgOpen = true;
	}
</script>

<Dialog bind:open={dlgOpen} selection aria-labelledby="list-title" aria-describedby="list-content">
	<Title>
		<inline-icon class="material-icons">language</inline-icon>
		{msg('language')}
	</Title>
	<Content>
		<List>
			{#each localePickerItems as item}
				<Item
					onclick={() => {
						dlgOpen = false;
						Cookies.set(i18n.config.cookie, item.locale);
						location.reload();
					}}
				>
					<Text>{item.label}</Text>
				</Item>
			{/each}
		</List>
	</Content>
	<Actions>
		<Button
			onclick={() => {
				dlgOpen = false;
			}}
		>
			<Label>{msg('cancel')}</Label>
		</Button>
	</Actions>
</Dialog>
