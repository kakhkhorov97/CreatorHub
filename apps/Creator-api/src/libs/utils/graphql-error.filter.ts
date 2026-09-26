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
import { duplicateKey } from './policy';

@Catch()
export class GraphqlErrorFilter implements ExceptionFilter {
	catch(error: unknown, _host: ArgumentsHost) {
		if (error instanceof HttpException) return error;
		if (duplicateKey(error)) return new ConflictException('This unique value is already in use');
		if (
			error instanceof MongooseError.ValidationError ||
			error instanceof MongooseError.CastError ||
			error instanceof MongooseError.StrictModeError
		)
			return new BadRequestException('Invalid record data');
		return new InternalServerErrorException('The request could not be completed');
	}
}
