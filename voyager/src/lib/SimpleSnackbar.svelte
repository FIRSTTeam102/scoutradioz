<!--
	@component 
	Wrapper for SMUI's Snackbar with open() and error() functions to open a regular snackbar message and error snackbar message, respectively.
	
		<SimpleSnackbar bind:this={snackbar}/>
		<script>
			let snackbar: SimpleSnackbar;
			snackbar.open('myMessage', 5000);
		</script>
 -->

<script lang='ts'>
	import Snackbar, {Label, Actions} from '@smui/snackbar';
	import { classMap } from '@smui/common/internal';
	import IconButton from '@smui/icon-button';
	
	let timeoutMs;
	let isError: boolean;
	let message: string;
	let snackbar: Snackbar;
	
	export function open(text: string, timeout?: number) {
		message = text;
		timeoutMs = timeout;
		isError = false;
		snackbar.forceOpen();
	}
	
	export function error(text: string, timeout?: number) {
		message = text;
		timeoutMs = timeout;
		isError = true;
		snackbar.forceOpen();
	}
	
</script>
<Snackbar bind:this={snackbar} class={classMap({error: isError})} timeoutMs={10000} on:close>
	<Label>{message}</Label>
	<Actions>
		<IconButton class="material-icons" title="Dismiss">close</IconButton>
	</Actions>
</Snackbar>