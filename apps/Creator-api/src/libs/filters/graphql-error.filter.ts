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
	catch(error: unknown, _host: ArgumentsHost) {
		if (error instanceof HttpException) return error;
		if (duplicateKey(error)) return new ConflictException(Message.VALUE_IN_USE);
		if (
			error instanceof MongooseError.ValidationError ||
			error instanceof MongooseError.CastError ||
			error instanceof MongooseError.StrictModeError
		)
			return new BadRequestException(Message.INVALID_RECORD);
		return new InternalServerErrorException(Message.REQUEST_FAILED);
	}
}
