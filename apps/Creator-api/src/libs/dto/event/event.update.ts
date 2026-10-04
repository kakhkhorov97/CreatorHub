import { InputType } from '@nestjs/graphql';
import { EventInput } from './event.input';

@InputType()
export class UpdateEventInput extends EventInput {}
