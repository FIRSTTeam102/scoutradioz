// Express namespace can be extended, as documented in the comments at the top of https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/express-serve-static-core/index.d.ts

declare namespace Express {
	
	interface StringDict {
		[key: string]: unknown;
	}
	
	// JL note: Unfortunately, it is impossible to mix import statements with namespace declarations.
	//	We could have scoutradioz-types export a namespace "SR" with all its interfaces inside, but
	//	then we would need to either wrap every route in namespace SR {} or type smth like "SR.Match" for 
	//	every typecast in our routes.
	export interface User {
		_id: any;
		org_key: string;
		name: string;
		role_key: 'scouter' | 'viewer' | 'team_admin' | 'global_admin';
		password: string;
		org_info: {
			subteam_key: string;
			class_key: string;
			years: string|number; // TODO: only number
			seniority: string|number; // TODO: only number
		};
		event_info: {
			present: boolean;
			assigned: boolean;
		};
		visible: boolean;
		role: {
			role_key: string;
			label: string;
			access_level: number;
		};
		org: {
			org_key: string;
			nickname: string;
			team_number?: number;
			team_numbers?: number[];
			team_key?: string;
			team_keys?: string[];
			default_password: string;
			config: {
				members: {
					subteams: Array<{
						label: string;
						subteam_key: string;
						pit_scout: boolean;
					}>;
					classes: Array<{
						label: string;
						class_key: string;
						seniority: number;
						youth: boolean;
					}>;
				};
				columnDefaults: {
					[key: string]: string;
				};
			}}
		push_subscription?: any; // Can't import PushSubscription from web-push in this file
	}

	// Extensions added by i18n middleware to request/response/locals
	// It would be nice if these could be gotten from i18n.ts instead
	export interface I18nExpressExtensions {
		locale: string;
		msg: (name: string, parameters?: Record<string, string | number>) => string;
		msgUrl: (name: string, parameters?: Record<string, string | number>) => string;
		msgJs: (name: string, parameters?: Record<string, string | number>) => string;
		msgMarked: (name: string, parameters?: Record<string, string | number>) => string;
		getLocales: () => StringDict[];
		getLocaleName: (locale: string, inLocale?: string) => string;
		getLocaleDir: (locale: string) => 'ltr' | 'rtl';
	}

	export interface Request extends I18nExpressExtensions {
		requestTime: number;
		timezoneString: string;
		localeString: string;
		
		event: {
			key: string;
			name: string;
			year: number;
			timezone: string;
		}
		
		shortagent: {
			ip: string;
			device: string;
			os: string;
			browser: string;
		}
		
		// @ts-ignore
		/**
		 * Because the type of req.user is declared in Passport as User|undefined, TypeScript will always think that
		 * req.user can possibly be undefined, even though we have checks in middleware / auth methods to not proceed if
		 * req.user is not defined. 
		 * 
		 * To get around this, we can use req._user in the routes where we *know* req.user is defined.
		 * @property {User} _user User from database.
		 */
		_user: User
		
		teams?: Array<{
			address: string|null;
			city: string|null;
			country: string|null;
			gmaps_place_id: any;
			gmaps_url: any;
			key: string;
			lat: any;
			lng: any;
			location_name: any;
			motto: string|null;
			name: string;
			nickname: string;
			postal_code: string|null;
			rookie_year: number|null;
			school_name: string|null;
			state_prov: string|null;
			team_number: number;
			website: string|null;
		}>;
		
		/**
		 * Gets the redirectURL WITHOUT encoding ? and & (for performing the actual redirection)
		 */
		
		getRedirectURL: () => string;
		
		/**
		 * Gets the redirectURL, automatically with ? and & encoded
		 */
		getFixedRedirectURL: () => string|undefined;
		
		/**
		 * Function to fix redirectURL by urlencoding ? and &, and clearing it if it's "undefined"
		 */
		fixRedirectURL: (str: string) => string|undefined;
		/**
		 * Function to add query parameters to an URL, respecting the one ? rule, with an object of parameters & their values which CAN be undefined or null. Undefined/null parameters are removed.
		 * @param {string} url URL
		 * @param {object} parameters Parameters to modify.
		 * @returns {string} URL with the query parameters automatically fixed.
		 */
		getURLWithQueryParameters: (url: string, parameters: StringDict) => string;
		
		/**
		 * Checks if a user is authenticated at a given access level. Automatically redirects the user if not authenticated.
		 */
		authenticate: (accessLevel: string|number|undefined) => Promise<boolean>;
	}
	
	export interface Request2 extends Request {
		user: User;
	}

	export interface Response extends I18nExpressExtensions {
		locals: Partial<I18nExpressExtensions> & Record<string, any>; // @fixme
	}
}

declare namespace Process {
	interface ProcessEnv {
		ACCESS_SCOUTER: string;
	}
}