import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import utilities from '$lib/server/utilities';

export const POST: RequestHandler = async ({ params, request }) => {
	
	const { org_password } = await request.json();
	const org_key = params.org_key;
	
	const org = await utilities.findOne('orgs', {org_key});
	
	const comparison = await bcrypt.compare(org_password, org.default_password);
	
	console.debug(`Org ${org_key} password comparison: ${comparison}`);
	
	if (comparison !== true) {
		throw error(401, `Incorrect password for org ${org_key}`);
	}
	
	const users = await utilities.find('users', 
		{org_key, visible: true}, 
		{sort: {name: 1}}
	);
	return json(users);
};