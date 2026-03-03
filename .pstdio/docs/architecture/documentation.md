# Documentation

Docs are plain markdown files committed to the repo under `.pstdio/docs/`. All clients read them through the API — the file-reading logic lives in one place (`pstdio-storage`).

## Storage layout

```
.pstdio/docs/
├── navigation.json   ← sidebar structure (sections, links)
├── index.md
├── specs/
│   └── *.md
└── architecture/
    └── *.md
```

- **`navigation.json`** defines the sidebar tree. Each entry has `text`, an optional `link` (maps to a `.md` file), and optional nested `items`.
- **Markdown files** are discovered by link — `/architecture/api` resolves to `architecture/api.md`.

## Architecture

```
┌───────────┐   ┌───────────┐   ┌───────────────┐
│    CLI    │   │    TUI    │   │   Dashboard   │
└─────┬─────┘   └─────┬─────┘   └───────┬───────┘
      │               │                 │
      └───────────────┼─────────────────┘
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

All three surfaces call the same API endpoints. The API delegates to `createDocsService` in `pstdio-storage`, which handles:

- Parsing and validating `navigation.json`
- Resolving links to markdown files
- Path-traversal protection (prevents reads outside `.pstdio/docs/`)

## API endpoints

| Method | Path                              | Description                            |
| ------ | --------------------------------- | -------------------------------------- |
| GET    | /v1/projects/:id/docs             | Returns the sidebar (navigation.json)  |
| GET    | /v1/projects/:id/docs/:link       | Returns a single markdown document     |

## Scaffolding

During `pstdio projects create` / `pstdio projects link`, `scaffoldDocs()` copies template docs from `packages/pstdio/files/docs/` into `.pstdio/docs/` if the directory doesn't exist yet. This is a one-time local operation — it doesn't go through the API.
