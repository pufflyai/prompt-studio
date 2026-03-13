# pstdio

## 0.1.1

### Patch Changes

- 08be990: Add optimistic follow-up messaging and keep chat input focused after send.
- a853ae3: Hide archived sessions in the sessions panel and hide the session bubble on sessions routes.
- a853ae3: Prevent PGlite corruption by rejecting concurrent DB opens and closing on startup failures.
- a853ae3: Hide draft tickets from the dashboard tickets panel list and board views.
- a853ae3: Inject the CLI version from package metadata so compiled binaries report the correct version.
- 08be990: Open the session bubble for implement and refine ticket submits.
- 08be990: Switch ticket local directories to shorthand-only paths and automatically normalize legacy slugged folders.
- 08be990: Improve session UX by returning Open in bubble to the last non-sessions page and exporting full conversation JSON.
- a853ae3: Fix session bubble rendering, musl binary resolution, and release version sync ordering.
- a853ae3: Ensure tickets write always sets draft: true in local frontmatter.
- a853ae3: Handle session stream `/messages` full-array add/replace patches in the dashboard chat reducer.
- 08be990: Skip empty session message parts when storing and rendering.
- 08be990: Show ticket board card session indicators and workspace diff badges with direct open actions.
- a853ae3: Trim bearer tokens before API authentication checks.

## 0.1.0

### Minor Changes

- 5134866: Initial release

### Patch Changes

- 35b773f: Replace the bundled legacy requirements template with a merged `prd` template and update docs and skills to scaffold requirements docs with `prd`.

  Add a bundled `lessons-learned` postmortem template and document it across pstdio skills and template docs.
