<!--
	@component 
	Confirmation dialog component, designed to have a similar "API" for opening it to Primary's "Confirm" 
	
	TODO: Implement password prompt
 -->

<script lang="ts">
	import Button, { Label } from '@smui/button';
	import Dialog, { Actions, Content, InitialFocus, Title } from '@smui/dialog';
	import Textfield from '@smui/textfield';

	import { msg } from './i18n';
	import SvelteMarkdown from 'svelte-markdown';
	import { classMap } from '@smui/common/internal';

	interface ConfirmOptions {
		yesText?: string;
		noText?: string;
		yesTimeout?: number;
		prompt?: 'password' | 'text' | boolean;
		disableNo?: boolean;
	}

	let open = false;
	let dlgTitle = '';
	let dlgBody = '';
	let onClose: (e: CustomEvent<{ action: string }>) => void = () => undefined;
	let yesDisabled = false;
	let password = '';
	let text = '';

	const defaultOptions = {
		yesText: msg('ok'),
		noText: msg('cancel'),
		yesTimeout: -1,
		prompt: false,
		disableNo: false,
	};

	let options: Required<ConfirmOptions> = defaultOptions;

	type DialogResult = { cancelled: boolean; password?: string; text?: string };

	export function show(title: string, body: string, opts?: Partial<ConfirmOptions>) {
		return new Promise<DialogResult>((resolve) => {
			dlgTitle = title;
			dlgBody = body;

			options = {
				yesText: opts?.yesText ?? defaultOptions.yesText,
				noText: opts?.noText ?? defaultOptions.noText,
				yesTimeout: opts?.yesTimeout ?? defaultOptions.yesTimeout,
				prompt: opts?.prompt ?? defaultOptions.prompt,
				disableNo: opts?.disableNo ?? defaultOptions.disableNo,
			};

			onClose = (e) => {
				console.log(e);
				let ret: DialogResult = { cancelled: true };
				// 'Yes' button clicked (Anything except "Yes" results in cancelled = true)
				if (e.detail.action === 'yes') {
					ret.cancelled = false;
				}
				if (options.prompt === 'password') ret.password = password;
				if (options.prompt === 'text') ret.text = text;
				resolve(ret);
			};
			if (options.yesTimeout > 0) {
				yesDisabled = true;
				setTimeout(() => {
					yesDisabled = false;
				}, options.yesTimeout);
			}

			open = true;
		});
	}
</script>

<Dialog
	bind:open
	aria-labelledby="default-focus-title"
	aria-describedby="default-focus-content"
	on:SMUIDialog:closed={onClose}
>
	<Title id="default-focus-title">{dlgTitle}</Title>
	<Content id="default-focus-content">
		<SvelteMarkdown source={dlgBody} />
		<Textfield
			type="password"
			style='width: 100%'
			variant='outlined'
			use={[InitialFocus]}
			bind:value={password}
			class={classMap({ hidden: options.prompt !== 'password' })}
		/>
		<Textfield bind:value={password} class={classMap({ hidden: options.prompt !== 'text' })} />
	</Content>
	<Actions>
		{#if !options.disableNo}
			<Button action="no">
				<Label>{options.noText}</Label>
			</Button>
		{/if}
		<Button
			defaultAction
			variant="unelevated"
			action="yes"
			disabled={yesDisabled}
		>
			<Label>{options.yesText}</Label>
		</Button>
	</Actions>
</Dialog>
