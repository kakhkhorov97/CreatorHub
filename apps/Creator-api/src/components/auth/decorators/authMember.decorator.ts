import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphqlContext } from '../guards/auth.guard';
import { User } from '../../../libs/dto/user/user';

export const AuthMember = createParamDecorator((field: keyof User | undefined, context: ExecutionContext) => {
	const user = GqlExecutionContext.create(context).getContext<GraphqlContext>().req.user;
	return field ? user?.[field] : user;
});
