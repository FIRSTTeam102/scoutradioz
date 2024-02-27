import { error } from "@sveltejs/kit";

/** Similar to assert but used in HTTP routing and throws a Svelte error. */
export default function httpAssert(condition: unknown, status?: number, message?: string) {
	if (!condition) {
		console.error('Error:', message || 'unknown');
		throw error(status || 500, new Error(message || 'Assertion failure'))
	}
}