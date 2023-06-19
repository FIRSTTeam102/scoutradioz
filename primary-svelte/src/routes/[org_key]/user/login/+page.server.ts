import type { Actions } from './$types';
import bcrypt from 'bcryptjs';
import utilities from '$lib/server/utilities';
import { error, fail, redirect } from '@sveltejs/kit';
import { msg } from '$lib/i18n-placeholder';
import { auth } from '$lib/server/lucia';
import Permissions from '$lib/permissions';
import type { User } from 'scoutradioz-types';

export const actions = {
	listUsers: async ({request, params}) => {
		
		const org_key = params.org_key;
		
		const data = await request.formData();
		const org_password = data.get('org_password');
		
		console.debug(`Request to listUsers for org key ${org_key}`);
		
		if (typeof org_key !== 'string' || typeof org_password !== 'string') {
			return fail(400, { message: msg('user.resubmitlogin') });
		}
		
		if (!await testOrgPassword(org_key, org_password)) {
			return fail(401, { message: msg('user.resubmitlogin') });
		}
		
		const userList = await utilities.find('users', 
			{org_key, visible: true, removed: {$ne: true}}, 
			{sort: {name: 1}}
		);
		
		return {
			org_password_accepted: true,
			userList,
			org_password,
		};
	},
	selectUser: async ({request, params, locals}) => {
		
		const org_key = params.org_key;
		
		const data = await request.formData();
		const org_password = data.get('org_password');
		const selected_user_id = data.get('user_select');
		const newPassword1 = data.get('newPassword1');
		const newPassword2 = data.get('newPassword2');
		const personalPassword = data.get('personalPassword');
		
		if (typeof org_key !== 'string' || typeof org_password !== 'string' || typeof selected_user_id !== 'string') {
			return fail(400, { message: msg('user.resubmitlogin') });
		}
		
		if (!await testOrgPassword(org_key, org_password)) {
			return fail(401, { message: msg('user.resubmitlogin') });
		}
		
		const user = await utilities.findOne('users',
			{org_key, visible: true, removed: {$ne: true}, _id: selected_user_id}
		);
		
		if (!user) {
			return fail(400, { message: msg('user.nouserexists') });
		}
		
		console.debug(`user: ${JSON.stringify(user)}`);
		
		let role_key = user.role_key;
		const userRole = await utilities.findOne('roles',
			{role_key}, {},
			{allowCache: true}
		);
			
		//If no such role exists, throw an error because there must be one
		if (!userRole) throw error(500, `user/login.selectUser: No role exists in DB with key ${role_key}`);
	
		// 2022-04-03 JL: Sanity check for scoutradioz_admin user. While the bcrypt comparison should always fail when password === "disabled", I'd rather not run the risk. 
		if (user.password === 'disabled') {
			return {
				message: 'You cannot sign in as this user.'
			};
		}
		
		const userList = await utilities.find('users', 
			{org_key, visible: true, removed: {$ne: true}}, 
			{sort: {name: 1}}
		);
	
		//if user's access level is greater than scouter, then a password is required.
		if (userRole.access_level > Permissions.ACCESS_SCOUTER){
			console.log('Greater than scouter');
			//if user does not have a password but NEEDS a password, then they will need to create one
			if( user.password === 'default' ){
				
				// Check if they specified a password
				if (typeof newPassword1 === 'string' && typeof newPassword2 === 'string') {
					return createPassword(locals, user, newPassword1, newPassword2);
				}
				
				return {
					create_password: true,
					selected_user_id,
					org_password_accepted: true,
					userList,
					org_password,
				};
			}
			//if user has a non-default password, then they will need to enter it
			else{
				return {
					password_needed: true,
					selected_user_id,
					org_password_accepted: true,
					userList,
					org_password,
				};
			}
		} 
		else if (userRole.access_level === Permissions.ACCESS_SCOUTER){
		
			//First, check if the user has a password that is default
			if( user.password === 'default'){
			
				console.debug('Logging in scouter');
		
				// If password is default, then we can proceed with the login
				
				const session = await auth.createSession(String(user._id));
				locals.auth.setSession(session);
				// Now redirect to org home
				redirect(302, `/${params.org_key}/home`);
			}
			else{
			
				console.debug('Sending password_needed: true');
				//if password is not default, then return with password needed.
				return {
					password_needed: true,
					selected_user_id,
					org_password_accepted: true,
					userList,
					org_password,
				};
			}
		}
		// Viewer
		else {
		
			console.debug('Logging in viewer');
			
			const session = await auth.createSession(String(user._id));
			locals.auth.setSession(session);
			// Now redirect to org home
			redirect(302, '.');
		}
	},
} satisfies Actions;

async function testOrgPassword(org_key: string, org_password: string) {
	
	const org = await utilities.findOne('orgs', {org_key});
	
	const comparison = await bcrypt.compare(org_password, org.default_password);
	
	console.debug(`Org ${org_key} password comparison: ${comparison}`);
	
	return comparison;
}

async function createPassword(locals: App.Locals, user: User, password1: string, password2: string) {
	
	password1 = password1.trim();
	password2 = password2.trim();
	
	// Validate
	if (password1 !== password2) return fail(400, { message: msg('user.newpasswordmismatch') });
	if (!password1 || !password2) return fail(400, { message: msg('user.newpasswordboth') });
	
	// Hash password
	const saltRounds = 12;
	let hash = await bcrypt.hash(password1, saltRounds);
	
	// Update user
	let writeResult = await utilities.update('users', {
		_id: user._id,
	}, {
		$set: {password: hash}
	});
	
	console.debug('createpassword writeresult', JSON.stringify(writeResult));
	
	// Log in
	const session = await auth.createSession(String(user._id));
	locals.auth.setSession(session);
	throw redirect(302, `/${user.org_key}/home`);
}