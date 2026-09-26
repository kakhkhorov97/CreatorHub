# Schema organization

Collection schemas are grouped by product domain, matching the component folders. Embedded objects live in their owning domain's `embedded/` folder and are not registered as collections.

```text
schemas/
├── user/
│   └── User.model.ts
├── auth/
│   ├── AuthSession.model.ts
│   └── AuthToken.model.ts
├── category/
│   └── Category.model.ts
├── creator/
│   ├── CreatorProfile.model.ts
│   └── embedded/
│       └── SocialLink.model.ts
├── project/
│   ├── PortfolioProject.model.ts
│   └── embedded/
│       └── PortfolioMedia.model.ts
├── service/
│   └── CreatorService.model.ts
├── engagement/
│   ├── ProjectLike.model.ts
│   ├── SavedProject.model.ts
│   └── ProjectComment.model.ts
├── inquiry/
│   ├── Inquiry.model.ts
│   ├── InquiryMessage.model.ts
│   ├── InquiryEvent.model.ts
│   └── embedded/
│       └── InquiryServiceSnapshot.model.ts
└── notification/
    └── Notification.model.ts
```

Each schema keeps its own fields, options, and indexes together. Import schema files directly from their domain folders. GraphQL types and inputs remain in `libs/dto/`; enums remain in `libs/enums/`.

There are 14 collection schemas and three embedded schemas. Nest modules register only the collections they use. The explicit database setup registry is in `database/models.ts`.
