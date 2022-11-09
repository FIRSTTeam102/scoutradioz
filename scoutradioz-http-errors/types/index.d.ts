export declare class HttpError extends Error {
    status: number;
    constructor(message?: string);
}
export declare class UserError extends HttpError {
    constructor(message?: string);
}
export declare class UnauthorizedError extends HttpError {
    constructor(message?: string);
}
export declare class ForbiddenError extends HttpError {
    constructor(message?: string);
}
export declare class NotFoundError extends HttpError {
    constructor(message?: string);
}
export declare class TeapotError extends HttpError {
    constructor(message?: string);
}
export declare class TooEarlyError extends HttpError {
    constructor(message?: string);
}
export declare class InternalServerError extends HttpError {
    constructor(message?: string);
}
export declare class InternalDatabaseError extends HttpError {
    constructor(message?: string);
}
export declare class ServiceUnavailableError extends HttpError {
    constructor(message?: string);
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
export declare function assert(condition: unknown, message?: string | HttpError): asserts condition;
declare const _default: {
    UserError: typeof UserError;
    UnauthorizedError: typeof UnauthorizedError;
    ForbiddenError: typeof ForbiddenError;
    NotFoundError: typeof NotFoundError;
    TeapotError: typeof TeapotError;
    TooEarlyError: typeof TooEarlyError;
    InternalServerError: typeof InternalServerError;
    InternalDatabaseError: typeof InternalDatabaseError;
    ServiceUnavailableError: typeof ServiceUnavailableError;
    assert: typeof assert;
};
export default _default;
