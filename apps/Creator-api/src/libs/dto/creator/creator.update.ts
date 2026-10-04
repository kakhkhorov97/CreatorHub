import { InputType, PartialType } from '@nestjs/graphql';

import { CreateCreatorInput } from './creator.input';

@InputType()
export class UpdateCreatorInput extends PartialType(CreateCreatorInput, { skipNullProperties: false }) {}
