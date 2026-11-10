# Temporary Bun runtime import identities

Proposed: 2026-11-09

Status: Accepted for PS-169; native Windows qualification remains pending.

## External limitation

The intended loader imports immutable runtime bundles with a distinct file-URL query for each
evaluation. Pinned Bun 1.4.4 retains failed top-level-await evaluation when that query changes.
The retry regression reproduces a transient HTTP failure: two source checks fetch only once
and both report the original error. Importing the same module by absolute filesystem path
with a distinct query evaluates again and recovers.

## Decision

Temporarily use Bun's absolute-path import with the existing per-load query counter in runtime
loading. This preserves immutable build output while separating evaluations. The workaround
stays in the loader; artifact identity and acceptance remain unchanged. The regression
`extension-check-retry.p0.test.ts` exercises recovery without rebuilding the artifact.

## Limitations

Absolute-path dynamic imports rely on Bun behavior. Native Windows checks must qualify this
path on both supported architectures. Cross-compilation alone does not establish that result.

## Removal

When the minimum Bun version changes, rerun the transient-evaluation regression using file
URLs. Restore file-URL imports once their query identities support retrying failed evaluation,
and remove this workaround while retaining the recovery test.
