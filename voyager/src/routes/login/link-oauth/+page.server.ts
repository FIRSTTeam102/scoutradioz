import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) {
		console.debug('locals.session is not defined; redirecting to /');
		return redirect(302, '/');
	}
	if (locals.user) {
		console.debug('locals.user is defined; redirecting to /');
	}
	if (!locals.session.githubId) {
		console.debug('locals.session.githubId is not defined; redirecting to /');
	}
	console.debug('everything ok, rendering page!');
	return {
		sessionId: locals.session.id,
	};
}