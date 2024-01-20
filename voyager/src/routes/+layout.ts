import type { LayoutLoad } from './$types';
import { i18n } from '$lib/i18n';
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
	await i18n.middleware();
};