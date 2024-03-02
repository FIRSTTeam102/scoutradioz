import type { Layout } from 'scoutradioz-types';
import type { str } from '$lib/localDB';
export declare type LayoutField = str<Layout>;
import type SimpleSnackbar from './SimpleSnackbar.svelte';
import type SimpleDialog from './SimpleDialog.svelte';
import type { Writable } from 'svelte/store';

/**
 * 
 */
export type SnackbarContext = {
	open: (...args: Parameters<SimpleSnackbar['open']>) => ReturnType<SimpleSnackbar['open']>,
	error: (...args: Parameters<SimpleSnackbar['error']>) => ReturnType<SimpleSnackbar['error']>,
	close: (...args: Parameters<SimpleSnackbar['close']>) => ReturnType<SimpleSnackbar['close']>,
}

export type DialogContext = {
	show: (...args: Parameters<SimpleDialog['show']>) => ReturnType<SimpleDialog['show']>,
};

/**
 * Control a contextual "refresh the contents of this page" button on the top bar.
 * Must set during `onMount()` and un-set during `onDestroy()`. If you don't
 * set `supported: false` on onDestroy, then the button will remain visible on all
 * other pages when you navigate away.
 * 
 * 		let refreshButton = getContext('refreshButton') as RefreshContext;
 *  		
 * 		onMount(() => {
 * 			refreshButton.set({
 * 				supported: true,
 * 				onClick: () => { ... }
 * 				label: 'Do stuff'
 * 			})
 * 		});
 * 
 * 		onDestroy(() => {
 * 			refreshButton.set({ supported: false });
 * 		})
 */
export type RefreshContext = Writable<{
	supported: boolean,
	onClick?: () => Promise<void>|void,
	tooltip?: string,
}>

/**
 * Control whether the refresh button plays a little spinny animation.
 */
export type RefreshButtonAnimationContext = {
	play: () => void,
	stop: () => void,
	/**
	 * Make the refresh button spin while the callback is being executed and then automatically stop.
	 * @param cb Function to run, preferably an async function.
	 */
	autoplay: (cb: () => Promise<void>|void) => Promise<void>,
}