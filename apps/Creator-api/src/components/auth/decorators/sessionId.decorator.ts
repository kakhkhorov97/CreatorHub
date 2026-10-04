import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphqlContext } from '../guards/auth.guard';

export const SessionId = createParamDecorator(
	(_data: unknown, context: ExecutionContext) =>
		GqlExecutionContext.create(context).getContext<GraphqlContext>().req.sessionId,
);
