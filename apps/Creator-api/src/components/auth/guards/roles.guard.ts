import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../../libs/enums/user-role.enum';
import { Message } from '../../../libs/enums/common.enum';
import { GraphqlContext } from './auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const roles = this.reflector.getAllAndOverride<UserRole[]>('roles', [context.getHandler(), context.getClass()]);
		if (!roles) return true;
		const { req } = GqlExecutionContext.create(context).getContext<GraphqlContext>();
		if (!req.user || !roles.includes(req.user.role)) throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
		return true;
	}
}
