# Artifacts Extension Rules

These rules are for contributors and agents who change this extension in the Prompt Studio repository. The [extension rules](../AGENTS.md) apply too.

## Local development

- Start an isolated Prompt Studio instance with `bun run dev:isolated`.
- From a linked project, run `pst extensions dev <absolute-path>/extensions/pstdio-artifacts` against that instance's API URL.
- The last valid development snapshot stays installed after the watcher stops. Nothing is installed into the project's `.pstdio/extensions` folder.
- For an installed smoke test outside the monorepo, use the packed SDK through the local workspace registry.
- This extension owns the preview and the theme handling. Do not move them into the host.

## Checks

- Run `bun test extensions/pstdio-artifacts` and `bun run --cwd extensions/pstdio-artifacts typecheck`.
- Component and preview stories live in the dashboard Storybook under **Extensions/Artifacts**.
- The browser tests are `packages/e2e/src/ui/artifacts.spec.ts` and `packages/e2e/src/ui/html-preview.spec.ts`. They cover agent publication, project separation, preview isolation and blocked navigation, theme changes without losing state, search, library and artifact tabs, stable breadcrumbs, published links, live updates, old revisions, clickable cards, rename, delete, translated controls, and reading a snapshot after its source file is removed.

## Storage

Artifact identities, revisions, names, and snapshots use project-scoped extension storage and artifact mounts. Deletion removes the identity before it cleans up revisions. A publication that finishes after deletion removes its own saved files and cannot restore the deleted URL.

Preview HTML travels through the existing command bridge and renders with `srcdoc` in an opaque iframe with `allow-scripts`. A separate enclosing frame owns the content security policy. Do not add an HTTP preview endpoint.
