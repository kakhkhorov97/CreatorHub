# Schema organization

All collection and embedded schemas use flat `schemas/*.model.ts` paths, matching Nestar. Each file contains its fields, options and indexes. Modules register their required collections with `MongooseModule.forFeature`; `database/models.ts` registers the complete set for database setup.

There are 17 collections and three embedded schemas. `SocialLink`, `PortfolioMedia` and `InquiryServiceSnapshot` are embedded values, not collections. Moving these files does not rename MongoDB collections or change stored fields or indexes.

GraphQL output DTOs stay in `libs/dto/<feature>/`. Creation inputs and update inputs are separate `*.input.ts` and `*.update.ts` files. Enums remain in `libs/enums/`.
