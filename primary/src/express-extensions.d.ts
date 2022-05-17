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
		org_key: string;
		name: string;
		role_key: string;
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
	}
	
	export interface Request {
		requestTime: number;
		timezoneString: string;
		localeString: string;
		
		event: {
			key: string;
			name: string;
			year: string|number;
			timezone: string;
		}
		
		shortagent: {
			ip?: string;
			device: string;
			os: string;
			browser: string;
		}
		
		// user?: {
		// 	org_key: string;
		// 	name: string;
		// 	role_key: string;
		// 	password: string;
		// 	org_info: {
		// 		subteam_key: string;
		// 		class_key: string;
		// 		years: string|number; // TODO: only number
		// 		seniority: string|number; // TODO: only number
		// 	};
		// 	event_info: {
		// 		present: boolean;
		// 		assigned: boolean;
		// 	};
		// 	visible: boolean;
		// 	role: {
		// 		role_key: string;
		// 		label: string;
		// 		access_level: number;
		// 	};
		// 	org: {
		// 		org_key: string;
		// 		nickname: string;
		// 		team_number?: number;
		// 		team_numbers?: number[];
		// 		team_key?: string;
		// 		team_keys?: string[];
		// 		default_password: string;
		// 		config: {
		// 			members: {
		// 				subteams: Array<{
		// 					label: string;
		// 					subteam_key: string;
		// 					pit_scout: boolean;
		// 				}>;
		// 				classes: Array<{
		// 					label: string;
		// 					class_key: string;
		// 					seniority: number;
		// 					youth: boolean;
		// 				}>;
		// 			};
		// 			columnDefaults: {
		// 				[key: string]: string;
		// 			};
		// 		}}
		// };
		
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
		
	}
}