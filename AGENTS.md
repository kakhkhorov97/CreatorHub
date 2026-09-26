# CreatorHub working notes

Read `docs/WORK_LOG.md` and `docs/BACKEND_REVIEW.md` before continuing backend work.

- This workspace is backend-only. The frontend is a separate project.
- Preserve the existing app paths and model/DTO/enum/module/service/resolver structure.
- Follow `docs/CreatorHub-ER-modeling-guide.md` and `docs/creatorhub-workflow.png` for domain behavior.
- Keep code readable as it is written. Use separate decorator lines, multiline schema fields, and blank lines between class members. Run `npm run format` after edits rather than leaving compressed code for a later pass.
- Use npm and the existing tab-based Prettier configuration.
- Record completed changes and actual verification results in `docs/WORK_LOG.md`. Update the review when implementation or limitations change.
- Do not describe deployment integrations as live unless they have been configured and verified.
