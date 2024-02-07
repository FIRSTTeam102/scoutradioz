import { error } from '@sveltejs/kit';

export function validateUserOrg(locals: App.Locals, org_key: string) {
	if (!org_key) throw error(400, new Error('Org key not specified'));
	if (locals.user?.org_key !== org_key) {
		throw error(401, new Error(`You are not logged in to org ${org_key}`));
	}
}
