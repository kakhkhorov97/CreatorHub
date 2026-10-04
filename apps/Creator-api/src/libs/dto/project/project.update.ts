import { InputType, PartialType } from '@nestjs/graphql';

import { CreateProjectInput } from './project.input';

@InputType()
export class UpdateProjectInput extends PartialType(CreateProjectInput, { skipNullProperties: false }) {}
