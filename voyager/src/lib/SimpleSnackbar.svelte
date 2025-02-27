<!--
	@component 
	Wrapper for SMUI's Snackbar with open() and error() functions to open a regular snackbar message and error snackbar message, respectively.
	
		<SimpleSnackbar bind:this={snackbar}/>
		<script>
			let snackbar: SimpleSnackbar;
			snackbar.open('myMessage', 5000);
		</script>
	
	TODO: Implement queue for multiple messages.
 -->

<script lang='ts'>
	import Snackbar, {Label, Actions} from '@smui/snackbar';
	import { classMap } from '@smui/common/internal';
	import IconButton from '@smui/icon-button';
	import Button from '@smui/button';
	
	let timeoutMs: number = 10000;
	let displayColor: string;
	let message: string;
	let snackbar: Snackbar;
	let currentCloseResolve: ((reason: string | undefined) => void) | null = null;
	let dismissAction: string|undefined;
	
	/**
	 * Open a snackbar message. Resolves when the snackbar is closed.
	 * @param text The message to display
	 * @param timeout The timeout in milliseconds. Defaults to 10 seconds. Pass -1 to disable.
	 * @param action The action to display. Defaults to an icon with an X.
	 * @param type The type of message to display (info/success/error/warn). Default is 'info'.
	 */
	export function open(text: string, timeout?: number, action?: string, type?: 'info'|'error'|'warn'|'success') {
		message = text;
		timeoutMs = timeout || 10000;
		dismissAction = action;
		displayColor = type || 'info';
		snackbar.forceOpen();
		return new Promise((resolve) => {
			currentCloseResolve = resolve;
		});
	}
	
	/**
	 * Open a snackbar message with a green success color. Resolves when the snackbar is closed.
	 * @param text The message to display
	 * @param timeout The timeout in milliseconds. Defaults to 10 seconds. Pass -1 to disable.
	 * @param action The action to display. Defaults to an icon with an X.
	 */
	export function success(text: string, timeout?: number, action?: string) {
		return open(text, timeout, action, 'success');
	}
	
	/**
	 * Open a normal snackbar message. Resolves when the snackbar is closed.
	 * @param text The message to display
	 * @param timeout The timeout in milliseconds. Defaults to 10 seconds. Pass -1 to disable.
	 * @param action The action to display. Defaults to an icon with an X.
	 */
	export function info(text: string, timeout?: number, action?: string) {
		return open(text, timeout, action, 'info');
	}
	
	/**
	 * Open a snackbar message with a warning color. Resolves when the snackbar is closed.
	 * @param text The message to display
	 * @param timeout The timeout in milliseconds. Defaults to 10 seconds. Pass -1 to disable.
	 * @param action The action to display. Defaults to an icon with an X.
	 */
	export function warn(text: string, timeout?: number, action?: string) {
		return open(text, timeout, action, 'warn');
	}
	
	/**
	 * Open an error snackbar message with an error color. Resolves when the snackbar is closed.
	 * @param text The message to display
	 * @param timeout The timeout in milliseconds. Defaults to 10 seconds. Pass -1 to disable.
	 * @param action The action to display. Defaults to an icon with an X.
	 */
	export function error(text: string, timeout?: number, action?: string) {
		return open(text, timeout, action, 'error');
	}
	
	export function close() {
		snackbar.close();
	}
	function handleClosed(e: CustomEvent<{ reason: string | undefined }>) {
		if (currentCloseResolve) {
			currentCloseResolve(e.detail.reason);
			currentCloseResolve = null;
		}
	}
	
</script>
<Snackbar bind:this={snackbar} class={displayColor} timeoutMs={timeoutMs}  onSMUISnackbarClosed={handleClosed}>
	<Label>{message}</Label>
	<Actions>
		{#if dismissAction}
			<Button title={dismissAction}>{dismissAction}</Button>
		{:else}
			<IconButton class="material-icons" title="Dismiss">close</IconButton>
		{/if}
	</Actions>
</Snackbar>