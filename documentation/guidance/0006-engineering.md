# Engineering

## 1. Toolchain

1. This is a Lerna monorepo managed with Bun and Nx caching.
2. Write TypeScript only.
3. Use Bun. Do not use npm, Yarn, or pnpm.

## 2. System design

1. Keep the solution simple and preserve or improve the project structure. Make a larger change when needed to do so.
2. Start with the normal, successful case.
3. Add backward compatibility only when specifically requested, except for the public extension API in section 7.
4. Do not add checks or code for problems outside current requirements.
5. Remove old or unused code, subject to the public extension API deprecation rules.
6. Fix the cause rather than only the visible problem.
7. Think carefully before adding flags, statuses, optional fields, stored values, special cases, or compatibility code.
8. Add state only when existing data cannot provide it. Give it a clear meaning, one owner, and rules for creation, changes, and removal.
9. Fix data flow and ownership directly. Do not create duplicate data that needs synchronization.
10. Change the database only when product data needs to change, not just to simplify a bug fix.
11. Aim for the simplest complete solution, not the smallest diff.
12. Fix a problem in the part of the system responsible for it. Do not build a large solution for a small local issue.
13. Reconsider a design that needs a workaround flag, special case, duplicate data, or internal details exposed across layers.
14. Tests must prove restored behavior and system rules rather than preserve a workaround.

## 3. Before writing code

1. Identify what caused the problem.
2. Identify the system rule being broken.
3. Identify which part of the system should enforce it.
4. Choose the simplest design that prevents recurrence.
5. If an external limit forces a workaround, write an ADR before coding. Follow the [temporary-workaround rules](0008-planning.md#3-architecture-decisions).
6. If stuck, follow the [troubleshooting guidance](0009-troubleshooting.md) before trying another approach.

## 4. Code style

1. Keep content that may grow, such as endpoints and schemas, in separate files.
2. Keep every source file below about 350 lines. Documentation, tests, fixtures, helpers, mocks, benchmarks, and E2E packages have no line limit. `biome.json` lists exempt paths.
3. Use pure functions when possible.
4. Use comments to explain why, not what the code does.
5. Let TypeScript infer return types. Do not write them explicitly.
6. Do not nest ternary expressions.
7. Do not use deep relative imports across packages.
8. Do not import from `clients/*`.

## 5. React

1. Do not use `memo()`, `useCallback()`, or `useMemo()`. The React compiler handles this work.
2. Put complex prop definitions in an interface.
3. Destructure props inside the function.
4. Use components instead of `render*` helpers. Move extracted UI logic into a component.
5. Use kebab-case component filenames, such as `my-component.tsx`.
6. Never use `NativeSelect`.
7. Follow the [design and styling rules](0002-design.md#3-styling-rules).

## 6. Extension storage

1. Keep all extension-owned project files under `.pstdio/extension-storage/<publisher>.<name>/`: configuration, caches, drafts, prototypes, screenshots, ticket and report checkouts, and migration backups.
2. Use `ctx.extensionFiles` or declared artifact mounts for files and `ctx.storage` for structured project data. Both file APIs stay inside the full extension-ID directory.
3. Prompt Studio 0.46 does not read the older `<name>/` or `.publishers/<publisher>/` folders.
4. Keep artifact drafts and prototypes under `.pstdio/extension-storage/pstdio.pstdio-artifacts/`. Put report evidence under the `filesPath` returned by `pst reports write`.
5. Do not create extension data folders directly under `.pstdio/` or keep runtime data in extension source folders. `.pstdio/extensions/` holds extension source.
6. Files an extension deliberately edits as project source, such as icon fonts, stay at their configured paths. The extension's own settings and working files stay in extension storage.

## 7. Public extension API

1. The public `@pstdio/sdk/extensions` types, manifest rules, bridge capabilities, and event payloads support external extensions. Their compatibility rules override the general rules to remove old code and add compatibility only on request.
2. Deprecate first. Add the replacement beside the old API and mark the old one `@deprecated`, naming its replacement.
3. Remove deprecated APIs together in one breaking release, not one breaking release per removal.
4. Follow the change levels and one-step-per-release rule in [API versioning](../references/extensions/0014-api-versioning.md).
