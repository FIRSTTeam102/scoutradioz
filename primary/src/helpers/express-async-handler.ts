/*
The MIT License (MIT)
Original copyright Alex Bazhenov (Modified version of https://github.com/Abazhenov/express-async-handler)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// Modified express-async-handler to allow for non-void returns, e.g. if(statement) return res.redirect('/');

// import express = require('express');
import type express from 'express';
import type core from 'express-serve-static-core';

/**
 * Wrap a normal GET route and use standard error handling logic that renders an error page
 */
function expressAsyncHandler < P = core.ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = core.Query >
(handler: (...args: Parameters<express.RequestHandler<P, ResBody, ReqBody, ReqQuery>>) => unknown | Promise<unknown>):
	express.RequestHandler<P, ResBody, ReqBody, ReqQuery> {
	return function asyncUtilWrap(...args) {
		const fnReturn = handler(...args);
		const next = args[args.length-1];
		
		if (typeof next === 'function')
			return Promise.resolve(fnReturn).catch(next);
		else
			return Promise.resolve(fnReturn);
	};
}

/**
 * Wrap an API route that doesn't render a page, and instead, sends the error message to the client as JSON
 */
function expressAsyncApiHandler < P = core.ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = core.Query >
(handler: (...args: Parameters<express.RequestHandler<P, ResBody, ReqBody, ReqQuery>>) => unknown | Promise<unknown>):
	express.RequestHandler<P, ResBody, ReqBody, ReqQuery> {
	return function asyncUtilWrap(req, res, next) {
		const fnReturn = handler(req, res, next);
		
		return Promise.resolve(fnReturn).catch(err => {
			let status = err.status || 500;
			let message = {message: String(err.message || err)};
			// @ts-expect-error dunno what ts is on about here
			return res.status(status).send(message);
		});
	};
}

export default expressAsyncHandler;
export const wrapAPI = expressAsyncApiHandler;