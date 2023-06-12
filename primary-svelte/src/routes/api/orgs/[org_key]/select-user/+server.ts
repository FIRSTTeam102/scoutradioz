import { json, error, } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import utilities from '$lib/server/utilities';
import { msg } from '$lib/i18n';
import Permissions from '$lib/permissions';

export const POST: RequestHandler = async ({ params, request }) => {
	
	const { org_password, user_id } = await request.json();
	const org_key = params.org_key;
	
	const org = await utilities.findOne('orgs', {org_key}, {}, {allowCache: true});
	
	// Instead of dealing with some sort of session token after they send the org password
	// 	to get the user list, it's simpler to just send the org_password again when they
	// 	try to log in to the org
	const comparison = await bcrypt.compare(org_password, org.default_password);
	
	if (comparison !== true) {
		throw error(401, `Incorrect password for org ${org_key}`);
	}
	
	const user = await utilities.findOne('users', {
		org_key,
		visible: true,
		removed: {$ne: true},
		_id: user_id
	});
	
	if (!user) {
		throw error(404, msg('user.nouserexists'));
	}
	
	const role_key = user.role_key;
	const userRole = await utilities.findOne('roles',
		{role_key}, {}, {allowCache: true}
	);
	
	// 2022-04-03 JL: Sanity check for scoutradioz_admin user. While the bcrypt comparison should always fail when password === "disabled", I'd rather not run the risk. 
	if (user.password === 'disabled') {
		throw error(400, 'You cannot sign in as this user.');
	}
	
	//if user's access level is greater than scouter, then a password is required.
	if (userRole.access_level > Permissions.ACCESS_SCOUTER) {
		
		//if user does not have a password but NEEDS a password, then they will need to create one
		if( user.password === 'default' ){
			return json({
				create_password: true,
			});
		}
		//if user has a non-default password, then they will need to enter it
		else{
			return json({
				password_needed: true,
			});
		}
	}
	else if (userRole.access_level > Permissions.ACCESS_SCOUTER) {
		
		// First, check if user has password that is default
		if (user.password === 'default') {
			
			console.debug('Logging in scouter');
			
			
		}
	}
	
	return json(users);
};