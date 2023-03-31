import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ url, fetch }) => {
	const key = url.searchParams.get('key');
	
	const teamNumber = Number(key?.replace('frc', ''));

	if (!key || !teamNumber) throw error(404, new Error('Team key is either not defined or invalid'));

	const layout: LayoutField[] = await (await fetch('/api/layout/pit')).json();

	return { layout, key, teamNumber };
};
