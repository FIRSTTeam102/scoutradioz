export class HttpError extends Error {
	status: number;
	constructor(message?: string) {
		super(message);
		this.status = -1;
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

export class ServiceUnavailableError extends HttpError {
	constructor(message?: string) {
		super(message || 'Service Unavailable');
		this.status = 503;
	}
}

module.exports = {
	UserError: UserError,
	UnauthorizedError: UnauthorizedError,
	ForbiddenError: ForbiddenError, 
	NotFoundError: NotFoundError,
	TeapotError: TeapotError,
	TooEarlyError: TooEarlyError,
	InternalServerError: InternalServerError,
	ServiceUnavailableError: ServiceUnavailableError
};
