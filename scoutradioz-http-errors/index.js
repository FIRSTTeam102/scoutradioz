class UserError extends Error {
	constructor(message) {
		super(message || 'Bad Request');
		this.status = 400;
	}
}

class UnauthorizedError extends Error {
	constructor(message) {
		super(message || 'Unauthorized');
		this.status = 401;
	}
}

class ForbiddenError extends Error {
	constructor(message) {
		super(message || 'Forbidden');
		this.status = 403;
	}
}

class TeapotError extends Error {
	constructor(message) {
		super(message || 'I\'m a teapot');
		this.status = 418;
	}
}

class TooEarlyError extends Error {
	constructor(message) {
		super(message || 'Too Early');
		this.status = 425;
	}
}

class InternalServerError extends Error {
	constructor(message) {
		super(message || 'Internal Server Error');
		this.status = 500;
	}
}

class ServiceUnavailableError extends Error {
	constructor(message) {
		super(message || 'Service Unavailable');
		this.status = 503;
	}
}

module.exports = {
	UserError: UserError,
	UnauthorizedError: UnauthorizedError,
	ForbiddenError: ForbiddenError, 
	TeapotError: TeapotError,
	TooEarlyError: TooEarlyError,
	InternalServerError: InternalServerError,
	ServiceUnavailableError: ServiceUnavailableError
};