import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../src/libs/interceptors/logging.interceptor';

describe('LoggingInterceptor', () => {
	it('measures handlers without changing values or recording private input', async () => {
		const details: Record<string, unknown> = { requestId: 'example' };
		const request = { body: { password: 'private-password' }, res: { locals: { requestLog: details } } };
		const context = {
			getType: () => 'http',
			switchToHttp: () => ({ getRequest: () => request }),
		} as unknown as ExecutionContext;
		const interceptor = new LoggingInterceptor();
		expect(await lastValueFrom(interceptor.intercept(context, { handle: () => of('result') } as CallHandler))).toBe(
			'result',
		);
		expect(details.handlerDurationMs).toBeGreaterThanOrEqual(0);
		expect(JSON.stringify(details)).not.toContain('private-password');
		const error = new Error('private-error');
		await expect(
			lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) } as CallHandler)),
		).rejects.toBe(error);
		expect(JSON.stringify(details)).not.toContain('private-error');
	});
});
