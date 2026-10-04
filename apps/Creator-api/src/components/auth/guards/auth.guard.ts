import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { User } from '../../../libs/dto/user/user';
import { AuthService } from '../auth.service';

export interface AuthRequest extends Request {
	user: User;
	sessionId: string;
}

export interface GraphqlContext {
	req: AuthRequest;
}

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { req } = GqlExecutionContext.create(context).getContext<GraphqlContext>();
		const header = req.headers.authorization;
		const { user, sessionId } = await this.auth.authenticate(header?.startsWith('Bearer ') ? header.slice(7) : '');
		req.user = user;
		req.sessionId = sessionId;
		return true;
	}
}
