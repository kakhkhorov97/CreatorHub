import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { finalize } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler) {
		const request =
			context.getType<string>() === 'graphql'
				? GqlExecutionContext.create(context).getContext<{ req: Request }>().req
				: context.switchToHttp().getRequest<Request>();
		const details = request.res?.locals.requestLog;
		const startedAt = performance.now();
		return next.handle().pipe(
			finalize(() => {
				if (details) details.handlerDurationMs = (details.handlerDurationMs ?? 0) + performance.now() - startedAt;
			}),
		);
	}
}
