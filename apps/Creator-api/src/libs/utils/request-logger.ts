import { Logger } from '@nestjs/common';
import { ApolloServerPlugin } from '@apollo/server';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

interface GraphqlRequestLog {
	type: string;
	name: string;
	fields: string[];
	errorCodes: string[];
}

interface RequestLog {
	requestId: string;
	graphql?: GraphqlRequestLog;
}

const logger = new Logger('RequestLogger');

export function requestLogger(request: Request, response: Response, next: NextFunction) {
	const startedAt = performance.now();
	const fallbackRoute = request.path === '/graphql' ? '/graphql' : '<unmatched>';
	const details: RequestLog = { requestId: randomUUID() };
	response.locals.requestLog = details;
	response.setHeader('X-Request-ID', details.requestId);
	let logged = false;

	const complete = () => {
		if (logged) return;
		logged = true;
		const aborted = !response.writableFinished;
		const entry = JSON.stringify({
			requestId: details.requestId,
			method: request.method,
			route: request.route?.path ?? fallbackRoute,
			status: response.statusCode,
			durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
			aborted,
			...(details.graphql ? { graphql: details.graphql } : {}),
		});
		if (response.statusCode >= 500 || details.graphql?.errorCodes.includes('INTERNAL_SERVER_ERROR')) {
			logger.error(entry);
		} else if (aborted || response.statusCode >= 400 || details.graphql?.errorCodes.length) {
			logger.warn(entry);
		} else {
			logger.log(entry);
		}
	};

	response.once('finish', complete);
	response.once('close', complete);
	next();
}

export const graphqlRequestLogger: ApolloServerPlugin<{ req: Request }> = {
	async requestDidStart(context) {
		const details = context.contextValue.req.res?.locals.requestLog as RequestLog | undefined;
		const graphql: GraphqlRequestLog = { type: 'unknown', name: 'anonymous', fields: [], errorCodes: [] };
		if (details) details.graphql = graphql;

		return {
			async didResolveOperation({ operation }) {
				if (!operation) return;
				graphql.type = operation.operation;
				graphql.name = operation.name?.value ?? 'anonymous';
				graphql.fields = [
					...new Set(
						operation.selectionSet.selections.flatMap((selection) =>
							selection.kind === 'Field' ? [selection.name.value] : [],
						),
					),
				];
			},

			async didEncounterErrors({ errors }) {
				graphql.errorCodes = [
					...new Set(
						errors.map((error) => {
							const code = error.extensions.code;
							return typeof code === 'string' && /^[A-Z_]{1,64}$/.test(code) ? code : 'INTERNAL_SERVER_ERROR';
						}),
					),
				];
			},
		};
	},
};
