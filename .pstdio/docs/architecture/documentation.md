# Documentation

Docs are plain markdown files committed to the repo under `.pstdio/docs/`. Clients should treat the folder tree as the source of truth and derive navigation from directories and markdown files, not from a separate manifest.

## Storage Layout

```
.pstdio/docs/
├── index.md
├── adrs/
│   └── *.md
├── architecture/
│   └── *.md
├── contributing/
│   └── *.md
├── lessons-learned/
│   └── *.md
├── product/
│   └── **/*.md
└── references/
    └── **/*.md
```

- **Root markdown files** such as `index.md` are entry points.
- **Top-level folders** define the public documentation taxonomy.
- **Nested folders** group related product and reference pages.
- **Markdown files** are discovered by path: `/architecture/api` resolves to `architecture/api.md`.

## Architecture

```
        ┌───────────┐   ┌───────────────┐
        │    CLI    │   │   Dashboard   │
        └─────┬─────┘   └───────┬───────┘
              │                 │
              └─────────────────┘
                      │  HTTP
                      ▼
              ┌───────────────┐
              │   pstdio-api  │
              │   /v1/docs/*  │
              └───────┬───────┘
                      │
                      ▼
              ┌──────────────┐
              │ pstdio-storage│  ← reads .pstdio/docs/ from disk
              │ docsService   │     (validation, path-traversal protection)
              └──────────────┘
```

Both surfaces call the same API endpoints. The API delegates to the docs service in storage, which handles:

- Discovering folders and markdown files deterministically
- Resolving links to markdown files
- Path-traversal protection (prevents reads outside `.pstdio/docs/`)

## API endpoints

| Method | Path                        | Description                                |
| ------ | --------------------------- | ------------------------------------------ |
| GET    | /v1/projects/:id/docs       | Returns the discovered documentation index |
| GET    | /v1/projects/:id/docs/:link | Returns a single markdown document         |

## Scaffolding

During `pstdio projects create` / `pstdio projects link`, `scaffoldDocs()` copies template docs from `packages/pstdio/files/docs/` into `.pstdio/docs/` if the directory doesn't exist yet. This is a one-time local operation — it doesn't go through the API.

## Taxonomy Rules

- Put architectural decisions in `adrs/` using the existing numbered ADR convention.
- Put system descriptions and runtime boundaries in `architecture/`.
- Put contributor workflow and maintenance guidance in `contributing/`.
- Put diagnostic writeups in `lessons-learned/`.
- Put user-facing how-to content in `product/`.
- Put exhaustive lookup material in `references/`.
