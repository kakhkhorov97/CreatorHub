# Schema organization

All collection and embedded schemas use flat `schemas/*.model.ts` paths. Each file contains its fields, options and indexes. Modules register their required collections with `MongooseModule.forFeature`; `database/models.ts` registers the complete set for database setup.

There are 21 collections and three embedded schemas. The current ER guide is `docs/CreatorHub-ER-modeling-guide.md`; dated diagram and schema metadata are in `docs/er-model/`. `SocialLink`, `PortfolioMedia` and `InquiryServiceSnapshot` are embedded values, not collections. Moving these files does not rename MongoDB collections or change stored fields or indexes.

GraphQL output DTOs stay in `libs/dto/<feature>/`. Creation inputs and update inputs are separate `*.input.ts` and `*.update.ts` files. Enums remain in `libs/enums/`.
