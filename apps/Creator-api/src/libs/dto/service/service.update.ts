import { InputType, PartialType } from '@nestjs/graphql';

import { CreateServiceInput } from './service.input';

@InputType()
export class UpdateServiceInput extends PartialType(CreateServiceInput, { skipNullProperties: false }) {}
