import { InputType, PartialType } from '@nestjs/graphql';

import { CategoryInput } from './category.input';

@InputType()
export class UpdateCategoryInput extends PartialType(CategoryInput, { skipNullProperties: false }) {}
