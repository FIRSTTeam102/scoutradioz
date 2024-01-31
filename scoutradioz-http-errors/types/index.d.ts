export declare class HttpError extends Error {
    status: number;
    disableStackTrace: boolean;
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
 * Error which has no stack trace.
 */
export declare class LightError extends HttpError {
    constructor(message: string);
}
/**
 * Throws an HTTP error if the condition is not met.
 * @param condition Condition to test
 * @param message If message is a string, then an {@link InternalServerError} is thrown with the message; if it is an HttpError, then this function will throw with that provided error.
 * @example
 * 	import e, {assert} from 'scoutradioz-http-errors';
 * 	assert(false, 'This is an error message'); // throws new InternalServerError('This is an error message')
 * 	assert(true); // Does not throw
 * 	assert(false); // throws new InternalServerError('Internal Server Error')
 * 	assert(false, new e.UserError('You gave us the wrong input!')); // throws new e.UserError('You gave us the wrong input!')
 */
export declare function assert(condition: unknown, message?: string | HttpError): asserts condition;
/**
 * Throws an HTTP error if the condition is not met, WITHOUT displaying a stack trace.
 * @param condition Condition to test
 * @param message If message is a string, then an {@link InternalServerError} is thrown with the message; if it is an HttpError, then this function will throw with that provided error.
 * @example
 * 	import e, { lightAssert } from '@firstteam102/http-errors';
 * 	lightAssert(false, 'This is an error message'); // throws new LightError('This is an error message')
 * 	lightAssert(true, 'This is an error message'); // Does not throw
 */
export declare function lightAssert(condition: unknown, message: string): asserts condition;
declare const _default: {
    HttpError: typeof HttpError;
    UserError: typeof UserError;
    UnauthorizedError: typeof UnauthorizedError;
    ForbiddenError: typeof ForbiddenError;
    NotFoundError: typeof NotFoundError;
    TeapotError: typeof TeapotError;
    TooEarlyError: typeof TooEarlyError;
    InternalServerError: typeof InternalServerError;
    InternalDatabaseError: typeof InternalDatabaseError;
    ServiceUnavailableError: typeof ServiceUnavailableError;
    LightError: typeof LightError;
    lightAssert: typeof lightAssert;
    assert: typeof assert;
};
export default _default;
