import type { Response } from 'express';
import { Message } from '../enums/common.enum';
import {
	ArgumentsHost,
	BadRequestException,
	Catch,
	ConflictException,
	ExceptionFilter,
	HttpException,
	InternalServerErrorException,
} from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';
import { duplicateKey } from '../helpers/policy';

@Catch()
export class GraphqlErrorFilter implements ExceptionFilter {
	catch(error: unknown, host: ArgumentsHost) {
		const exception =
			error instanceof HttpException
				? error
				: duplicateKey(error)
					? new ConflictException(Message.VALUE_IN_USE)
					: error instanceof MongooseError.ValidationError ||
						  error instanceof MongooseError.CastError ||
						  error instanceof MongooseError.StrictModeError
						? new BadRequestException(Message.INVALID_RECORD)
						: new InternalServerErrorException(Message.REQUEST_FAILED);
		if (host.getType() === 'http') {
			const response = host.switchToHttp().getResponse<Response>();
			const detail = exception.getResponse();
			response.status(exception.getStatus()).json(typeof detail === 'string' ? { message: detail } : detail);
			return;
		}
		return exception;
	}
}
