// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare namespace App {
	interface Error {
		message: string;
		name: string;
		stack?: string;
	}
	interface Locals {
		user: import('lucia').User | null;
		session: import('lucia').Session | null;
	}
	// interface PageData {}
	// interface Platform {}
}
