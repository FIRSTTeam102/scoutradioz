import type { PageLoad } from './$types';
import type { LayoutField } from '$lib/types';

export const load: PageLoad = async ({ url, fetch }) => {
	const org_key = url.searchParams.get('org_key');

	return { org_key };
};
