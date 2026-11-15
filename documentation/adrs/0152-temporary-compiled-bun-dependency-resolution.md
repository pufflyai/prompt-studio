# Temporary compiled Bun dependency resolution

Proposed: 2026-11-10

Status: Accepted for PS-169; native platform qualification remains pending.

## External limitation

The intended dependency inspection uses Bun's resolved module and the importing package's
nearest physical dependency binding as one consistent input. Pinned Bun 1.4.4 compiled
executables can resolve a non-index main or import/require-only conditional export to an older
ancestor package instead of its installed nested package. The same source-mode resolution selects
the nested package. Pi's compiled installation reproduced this with minimatch and
brace-expansion. Packaged regressions for both entry forms returned the ancestor command value
after restart before the fix, and retain the nested value afterwards.

## Decision

Temporarily retain both the nearest physical package binding and any additional module
reported by Bun when they differ. Preserve compiler aliases and escaping module inputs,
but never let that extra resolution discard the physical package required by the bundle.
Resolved entries outside the physical package cannot stand in for its own entries. An unresolved
physical entry uses the existing conservative full-package closure. The workaround stays in
dependency inspection and uses the same immutable snapshot paths.

## Limitations

The conservative closure can retain an extra package that the final bundle does not use.
It increases inspection and disk work for ambiguous resolution. It does not change extension
permissions or allow mutable source links. Native Linux and Windows behavior requires their
packaged checks; cross-compilation alone is insufficient.

## Removal

When the minimum Bun version changes, run both conflicting entry fixtures (conditional export and non-index main) in
both source and compiled hosts. Once both select the nested package consistently, remove
the extra ambiguous closure retention while preserving explicit compiler alias handling and
the regression that verifies the accepted command's value after restart.
