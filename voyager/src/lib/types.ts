import type { Layout } from 'scoutradioz-types';
import type { str } from '$lib/localDB';
export declare type LayoutField = str<Layout>;
import type SimpleSnackbar from './SimpleSnackbar.svelte';

export type SnackbarContext = {
	open: (...args: Parameters<SimpleSnackbar['open']>) => ReturnType<SimpleSnackbar['open']>,
	error: (...args: Parameters<SimpleSnackbar['error']>) => ReturnType<SimpleSnackbar['error']>,
	close: (...args: Parameters<SimpleSnackbar['close']>) => ReturnType<SimpleSnackbar['close']>,
}