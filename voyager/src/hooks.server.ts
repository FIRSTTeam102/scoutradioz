/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({
	error,
	event
}: {
	error: Error;
	event: import('@sveltejs/kit').RequestEvent;
}): App.Error {
	const is404 = event.route.id === null;
	return {
		message: is404 ? 'Route not found' : error.message,
		name: is404 ? 'Not found' : error.name || 'Error',
		stack: error.stack?.replace(/ {4}/g, '\t')
	};
}
