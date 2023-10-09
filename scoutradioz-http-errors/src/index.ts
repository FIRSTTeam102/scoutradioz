export class HttpError extends Error {
	status: number;
	disableStackTrace: boolean;
	constructor(message?: string) {
		super(message);
		this.status = -1;
		this.disableStackTrace = false; // default
	}
}

export class UserError extends HttpError {
	constructor(message?: string) {
		super(message || 'Bad Request');
		this.status = 400;
	}
}

export class UnauthorizedError extends HttpError {
	constructor(message?: string) {
		super(message || 'Unauthorized');
		this.status = 401;
	}
}

export class ForbiddenError extends HttpError {
	constructor(message?: string) {
		super(message || 'Forbidden');
		this.status = 403;
	}
}

export class NotFoundError extends HttpError {
	constructor(message?: string) {
		super(message || 'Not Found');
		this.status = 404;
	}
}

export class TeapotError extends HttpError {
	constructor(message?: string) {
		super(message || 'I\'m a teapot');
		this.status = 418;
	}
}

export class TooEarlyError extends HttpError {
	constructor(message?: string) {
		super(message || 'Too Early');
		this.status = 425;
	}
}

export class InternalServerError extends HttpError {
	constructor(message?: string) {
		super(message || 'Internal Server Error');
		this.status = 500;
	}
}

export class InternalDatabaseError extends HttpError {
	constructor(message?: string) {
		super(message || 'Internal Server Error (Database Contents)');
		this.status = 500;
	}
}

export class ServiceUnavailableError extends HttpError {
	constructor(message?: string) {
		super(message || 'Service Unavailable');
		this.status = 503;
	}
}

/**
 * Error which has no stack trace.
 */
export class LightError extends HttpError {
	constructor(message: string) {
		super(message);
		this.status = 400;
		this.disableStackTrace = true;
		this.stack = undefined;
	}
}

/**
 * Throws an HTTP error if the condition is not met.
 * @param condition Condition to test
 * @param message If message is a string, then an {@link InternalServerError} is thrown with the message; if it is an HttpError, then this function will throw with that provided error.
 * @example
 * 	import e, {assert} from '@firstteam102/http-errors';
 * 	assert(false, 'This is an error message'); // throws new InternalServerError('This is an error message')
 * 	assert(true); // Does not throw
 * 	assert(false); // throws new InternalServerError('Internal Server Error')
 * 	assert(false, new e.UserError('You gave us the wrong input!')); // throws new e.UserError('You gave us the wrong input!')
 */
export function assert(condition: unknown, message?: string|HttpError): asserts condition {
	if (!condition) {
		if (typeof message === 'string') {
			message = new InternalServerError(message);
		}
		if (!message) {
			message = new InternalServerError();
		}
		throw message;
	}
}

/**
 * Throws an HTTP error if the condition is not met, WITHOUT displaying a stack trace.
 * @param condition Condition to test
 * @param message If message is a string, then an {@link InternalServerError} is thrown with the message; if it is an HttpError, then this function will throw with that provided error.
 * @example
 * 	import e, { lightAssert } from '@firstteam102/http-errors';
 * 	lightAssert(false, 'This is an error message'); // throws new LightError('This is an error message')
 * 	lightAssert(true, 'This is an error message'); // Does not throw
 */
export function lightAssert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		let error = new LightError(message);
		throw error;
	}
}

export default {
	HttpError,
	UserError,
	UnauthorizedError,
	ForbiddenError, 
	NotFoundError,
	TeapotError,
	TooEarlyError,
	InternalServerError,
	InternalDatabaseError,
	ServiceUnavailableError,
	LightError,
	lightAssert,
	assert
};
