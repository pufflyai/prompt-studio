# Temporary React render input observation

Proposed: 2026-11-17

## Context

Performance needs to flag updates with no detected input changes during a short capture. The ideal scanner callback would expose change categories without exposing values. React Scan 0.5.3 emits an inactive unnecessary flag and its public scan entry point disables input change tracking.

## Decision

Use React Scan's update callback and the pinned Bippy traversal helpers to compare input identity. Keep the comparison in one adapter. Queue-bearing hooks supply state comparisons. React creates fresh effect records even with stable dependencies, so compare their dependency lists separately. Report unsupported changes as unknown. Only aggregate counts, names and self times leave the window.

## Limitations

Equality tests miss in-place mutations. Hook structures are tied to the pinned React and Bippy versions. Unknown or unmeasured entries cannot support a claim that a render was avoidable.

## Removal

Replace the adapter when the scanner can emit value-free input change categories with documented coverage. Keep the bounded capture and verify the same repeated-render and changed-state scenarios against the new source.
