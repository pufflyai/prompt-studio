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
bun run --cwd <path-to-extension> typecheck
```

Run the extension typecheck only when the extension package has that script. For first-party extension behavior, prefer
tests next to the relevant extension file or in the package that owns the runtime behavior.

## Install And Runtime Smoke

Install the extension source into a throwaway Prompt Studio home and validate loaded contributions:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions add <path-to-extension> --force
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions check
```

Do not pass `--skip-install` for a user/global install smoke test. The install must create package-local
dependencies under the installed extension root so the packaged runtime does not depend on workspace
`node_modules` symlinks or repo paths under `~/Documents`. Use `--skip-install` only for a deliberate
dev-link scenario where dependency installation has already been handled and the result will not be
treated as a production-like installed extension.

If the extension contributes CLI commands, inspect the generated help and run a happy-path command:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst <extension-name> --help
PSTDIO_HOME="$HOME/.pstdio-smoke" pst <extension-name> <command> --help
```

If dashboard UI or webviews must be checked, start the dashboard against the same throwaway home:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst
```

Then exercise the route, menu item, settings panel, renderer, or command palette entry in the dashboard.

## Packaged Artifacts

When bundled runtime artifacts change, such as extension skills, templates, prompts, themes, or packaged defaults,
reinstall the extension and confirm the packaged asset set still loads:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions add <path-to-extension> --force
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions check
```

Keep any packaged smoke-test expectations aligned with the current bundled artifact set.

## Final Validation

Before handoff for non-documentation changes, run the full validation command your project defines
(for example `bun run validate`). If validation cannot run, record the exact command, failure, and reason.
