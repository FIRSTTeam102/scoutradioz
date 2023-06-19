/* eslint-disable @typescript-eslint/consistent-type-imports */

import type { User } from 'scoutradioz-types';
import type { str } from 'scoutradioz-utilities';

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// user: str<User>;
			auth: import('lucia-auth').AuthRequest;
		}
		// interface PageData {}
		// interface Platform {}
	}
	
	// JL: Colors is no longer maintained, and the TS declarations are out of date.
	interface String {
		brightRed: string;
		brightGreen: string;
		brightYellow: string;
		brightBlue: string;
		brightMagenta: string;
		brightCyan: string;
		brightWhite: string;
		bgBrightRed: string,
		bgBrightGreen: string,
		bgBrightYellow: string,
		bgBrightBlue: string,
		bgBrightMagenta: string,
		bgBrightCyan: string,
		bgBrightWhite: string,
	}
	
	/**
	 * Key-value object holding strings.
	 */
	interface StringDict {
		[key: string]: string;
	}
	
	/**
	 * Key-value object holding numbers.
	 */
	interface NumericalDict {
		[key: string]: number;
	}
	
	/**
	 * Generic key-value object with a declared type. 
	 * @example var teamKeyMap: Dict<Team> = {}; 
	 * teamKeyMap['team0'] = teams[0];
	 */
	interface Dict<T> {
		[key: string]: T;
	}
	
	namespace Lucia {
		type Auth = import('$lib/server/lucia').Auth;
		type UserAttributes = {
			[key in Exclude<keyof User, '_id'>]: User[key]
		};
	}
}

export {};
