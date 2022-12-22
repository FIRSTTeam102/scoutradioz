import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';

export const load: PageLoad = async ({ url, fetch }) => {
	const key = url.searchParams.get('key');
	const teamNumber = Number(key?.replace('frc', ''));

	const layout: LayoutField[] = await (await fetch('/api/layout/pit')).json();

	return { layout, key, teamNumber };
};
