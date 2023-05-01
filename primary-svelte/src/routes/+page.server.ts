import utilities from '$lib/server/utilities';
import { getLogger } from 'log4js';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { msg } from '$lib/i18n-placeholder';
import type { Org, Event } from 'scoutradioz-types';
const logger = getLogger('index');

export const load: PageServerLoad = async({ cookies, url }) => {
	
	logger.addContext('funcName', 'root[get]');
	logger.debug('ENTER');
	
	// //If there is a logged-in user, that means they HAVE selected an org, and 
	// // so then redirect to /home
	// //If user has not selected an org (not logged in), send them to pick-org page.
	// if( req.user ){
		
	// 	//added originalUrl to make GET queries to persist (for alert)
	// 	res.redirect(307, '/home' + req.originalUrl);
	// }
	// else if ( req.query.org_key || req.cookies.org_key ){
	// 	//Prioritize QUERY org key over cookies
	// 	//If someone wishes to share a page in the future, the link will include org_key
	// 	let orgKey = req.query.org_key || req.cookies.org_key;
		
	// 	//redirect to selectorg with the selected org_key to sign in to the org user
	// 	res.redirect(307, `/selectorg?org_key=${orgKey}&redirectURL=${req.originalUrl}`);
	// }
	// else{
		
	// 2022-02-19 JL: Replaced all that timely/expensive eventMap stuff with a single aggregate call
	const aggPipeline = [
		{$sort: {team_number: 1, org_key: 1}},
		{$lookup: {
			from: 'events',
			localField: 'event_key',
			foreignField: 'key',
			as: 'event'
		}},
		{$set: {
			event_label: {$concat: [
				{ $toString: { $arrayElemAt: ['$event.year', 0]}},
				' ',
				{ $arrayElemAt: ['$event.name', 0]},
			]} 
		}},
		{$project: {
			event: 0
		}}
	];
	
	const orgs = await utilities.aggregate('orgs', aggPipeline, {allowCache: true}) as Array<Org & {
		event_label?: string,
		event?: Event,
	}>;
		
	const selectedButton = url.searchParams.get('customer') || cookies.get('homepageButton'); // Previously-selected "Are you:" button on the homepage
		
	return {
		fulltitle: msg('index.fulltitle'),
		orgs: orgs,
		redirectURL: '', //req.getFixedRedirectURL(), //redirectURL for viewer-accessible pages that need an organization to be picked before it can be accessed
		isOrgSelectScreen: true,
		selectedButton: selectedButton
	};
	// }
};