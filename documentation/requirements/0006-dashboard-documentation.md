---
status: "superseded"
created: "2026-03-10T20:12:05Z"
---

# Repository documentation and the retired core docs panel

## Current ownership

Project documentation is checked-in Markdown under `documentation/`. Start at the [documentation guide](../guides/0001-documentation.md). Read and edit it with repository tools. Moving these files does not register a dashboard page or configure a documentation server.

The old requirement for a core `/docs` panel and project documentation REST endpoints is superseded. Current dashboard modules and project API routes do not expose that reader. Those routes must not be presented as supported APIs.

## Product boundary

A dedicated documentation browser or authoring tool belongs in an extension. Core supplies files, storage, views, pages, and navigation through the public extension contract. An extension can choose its content roots and reading or editing policy; core does not require a particular documentation directory for every project.

The [Notes extension](../../extensions/pstdio-notes/README.md) currently provides editable notes. Its documents have separate IDs, titles, and content under extension-owned storage. It does not automatically index this repository's `documentation/` tree.

## Documentation requirements for this repository

1. Use `guides`, `references`, `requirements`, `adrs`, and `lessons-learned` categories.
2. Number every Markdown file within its category using `NNNN-kebab-case.md`.
3. Keep existing ADR and lesson identifiers stable, including gaps left by removed records.
4. Keep local links valid in a normal repository browser or editor.
5. Document supported behavior separately from proposed or superseded requirements.
6. Keep package and extension READMEs next to their owners and link to central documentation where useful.

## Evidence

- [Dashboard bootstrap](../../packages/pstdio-dashboard/src/modules/bootstrap.ts)
- [Project API routes](../../packages/pstdio-api/src/features/projects/routes.ts)
- [Notes extension](../../extensions/pstdio-notes/README.md)
