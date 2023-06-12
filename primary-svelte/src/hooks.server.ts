import * as cookie from 'cookie';
import { env } from '$env/dynamic/private';
import utilities from '$lib/server/utilities';
import type { Handle } from '@sveltejs/kit';
import log4js, { getLogger, type LoggingEvent } from 'log4js';

// import { SvelteKitAuth } from '@auth/sveltekit';
// import {  } from '@auth/sveltekit/client';
// import Credentials from '@auth/core/providers/credentials';
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/server/lucia';

// JL: Not sure which file to put this logger config into
let log4jsConfig = {
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '[%x{tier}] [%p] %c~%x{funcName} - %m',
		tokens: {
			'tier': () => {
				if (env.ALIAS) return env.ALIAS;
				else return 'LOCAL|' + env.TIER;
			},
			'funcName': (logEvent: LoggingEvent) => {
				if (logEvent.context && logEvent.context.funcName) {
					return logEvent.context.funcName;
				}
				else return '';
			},
		},
	} } },
	categories: {
		default: { appenders: ['out'], level: 'info' },
		off: { appenders: ['out'], level: 'off' },
	}
};
if( env.COLORIZE_LOGS == 'true'){
	//Colored pattern layout
	log4jsConfig.appenders.out.layout.pattern = '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c~%x{funcName} - %]%m';
}
log4js.configure(log4jsConfig);

const logLevel = env.LOG_LEVEL || 'debug';
log4js.getLogger().level = logLevel;

const logger = getLogger('hooks.server.ts');
logger.info(`Log level: ${logLevel}`);

// const authorization = (async ({ event, resolve }) => {
// 	// Protect any routes under /authenticated
// 	if (event.url.pathname.startsWith('/authenticated')) {
// 		const session = await event.locals.getSession();
// 		if (!session) {
// 			throw redirect(303, '/auth');
// 		}
// 	}
	
// 	return resolve(event);
// }) satisfies Handle;


export const handle: Handle = sequence(
	(async ({event, resolve}) => {
		logger.addContext('funcName', 'handle');
			
		logger.info('ENTER');
			
		// Utilities setup
		utilities.refreshTier(env.TIER, undefined, () => null);
		console.log(utilities.activeTier);
		return resolve(event);
	}),
	(async ({event, resolve}) => {
		event.locals.auth = auth.handleRequest(event);
		return await resolve(event);
	})
	// SvelteKitAuth({
	// 	providers: [
	// 		Credentials({
	// 			name: 'Credentials',
	// 			credentials: {
	// 				username: { label: 'Username' },
	// 				password: { label: 'Password', type: 'password' }
	// 			},
	// 			async authorize(credentials, request) {
	// 				console.log('authorize is running');
					
	// 				// Add logic here to look up the user from the credentials supplied
	// 				const user = { id: '1', name: 'J Smith', email: 'jsmith@example.com' };

	// 				if (user) {
	// 					// Any object returned will be saved in `user` property of the JWT
	// 					return user;
	// 				}
	// 				else {
	// 					// If you return null then an error will be displayed advising the user to check their details.
	// 					return null;

	// 					// You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
	// 				}
	// 			},
	// 		})
	// 	],
	// 	secret: 'foo bar',
	// 	// trustHost: true,
	// }),
	// authorization,
);

// export const handle = (async ({event, resolve}) => {
// 	logger.addContext('funcName', 'handle');
	
// 	logger.info('ENTER');
	
// 	// Utilities setup
// 	utilities.refreshTier(env.TIER, undefined, () => null);
// 	console.log(utilities.activeTier);
	
// 	// const cookies = event.cookies;
// 	// let session_id = cookies.get('session_id');
// 	// if (session_id) {
// 	// 	const session = await utilities.findOne('sessions', {_id: session_id});
// 	// 	if (session) {
// 	// 		let sessionData = JSON.parse(session.session);
// 	// 		const user = await utilities.findOne('users', {_id: sessionData?.passport?.user});
// 	// 		if (user) {
// 	// 			event.locals.user = user;
// 	// 			return await resolve(event);
// 	// 		}
// 	// 	}
// 	// }
	
// 	// Session
	
// 	return await resolve(event);
// }) satisfies Handle;