# Extension Validation

## TDD Loop

For behavior changes, reproduce the issue or missing behavior first:

1. Add the smallest test that proves the extension behavior.
2. Run the focused test and confirm it fails for the expected reason.
3. Implement the minimum code needed.
4. Re-run the focused test until green.
5. Refactor and re-run tests.

Skip tests for docs-only, config-only, generated wording, and UI-only changes. For UI changes, add or update stories
and use e2e checks when behavior changes.

## Focused Checks

Use Bun commands only.

```bash
bun test <path-to-test>
bun run --cwd extensions/<name> typecheck
```

Run the extension typecheck only when the extension package has that script. For first-party extension behavior, prefer
tests next to the relevant extension file or in the package that owns the runtime behavior.

## Install And Runtime Smoke

Install a local extension source and validate loaded contributions:

```bash
pst extensions add ./extensions/<name> --skip-install --force
pst extensions check
```

If the extension contributes CLI commands, inspect the generated help and run a happy-path command:

```bash
pst <extension-name> --help
pst <extension-name> <command> --help
```

If dashboard UI or webviews must be checked, run the isolated stack rather than a direct dev server:

```bash
bun run dev:isolated
```

Then exercise the route, menu item, settings panel, renderer, or command palette entry in the dashboard.

## Packaged Artifacts

When bundled runtime artifacts change, such as extension skills, templates, prompts, themes, or packaged defaults:

```bash
bun run --cwd scripts verify:packages
```

Keep packaged smoke-test expectations aligned with the current bundled artifact set.

## Final Repo Validation

Before handoff for non-documentation changes:

```bash
bun run validate
```

If validation cannot run, record the exact command, failure, and reason.
