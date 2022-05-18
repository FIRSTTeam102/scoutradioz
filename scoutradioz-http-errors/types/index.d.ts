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
