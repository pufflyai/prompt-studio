# PS-130 validation summary

Validated on 2026-07-13 from `workspace/PS-130_A1` after rebasing onto `origin/main`.

## Commands

- `bun run validate` — passed
- `bun run --cwd scripts verify:packages` — passed
- `git diff --check` — passed

## Notable results

- API package: 606 tests passed.
- CLI package: 103 tests passed.
- Chromium: 25 passed, 3 skipped by existing provider environment gates.
- Packaged smoke tests: 10 passed across all supported platform builds.
- Live model discovery returned model-specific thinking metadata from Codex and Claude Code and variant metadata from OpenCode.

## Regression coverage

- Provider catalogs map default models, labels, descriptions, and per-model supported thinking levels.
- Models with no effort support remove the thinking parameter.
- Unsupported persisted/default parameter values are pruned before session execution.
- Runtime validation rejects parameters unavailable for the selected model.
- Provider catalogs are cached per harness and retry after discovery failure.
- The dashboard selects a concrete catalog model, omits provider/default sentinel options, and updates thinking controls when the selected model changes.
- OpenCode preserves provider-qualified labels and ignores provider cost metadata; Claude normalizes its default alias to Opus and labels Fable clearly.
- Codex exposes model-specific reasoning effort without a separate reasoning-summary control.
