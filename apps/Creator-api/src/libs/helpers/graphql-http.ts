import { NextFunction, Request, Response } from 'express';

// Match Apollo's newer GET content-type protection while retaining bearer authentication.
export function protectGraphqlGet(request: Request, response: Response, next: NextFunction) {
	if (request.path === '/graphql' && request.method === 'GET') {
		for (let index = 0; index < request.rawHeaders.length - 1; index += 2) {
			if (
				request.rawHeaders[index].toLowerCase() === 'content-type' &&
				!/^application\/json(?:\s*;|$)/i.test(request.rawHeaders[index + 1])
			) {
				response.status(415).json({ error: 'Content-Type not allowed' });
				return;
			}
		}
	}
	next();
}
