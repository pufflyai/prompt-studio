# Temporary recovery for macOS extension dependency watches

Proposed: 2026-11-25
Status: Proposed

## External limitation

On macOS, Bun 1.4.4 shares an FSEvents stream across flat and recursive
watches. It tears down the stream when a watch is added or removed and
starts the replacement at the current event ID. A scoped package added
while an event batch is pending can be missed by both the recursive
source watch and the flat dependency watches. The public watch API
supplies no readiness or replay barrier.

## Decision

Keep the recursive source watch and remove the extra native handles on
`node_modules` and its direct scopes on macOS. A 500 ms check of directory
identity and modification time catches persistent membership changes
missed by native events. Native rename events still deliver prompt
updates. Only a dependency root change requires listing scope names.
The check opens no package directories, follows no symlinks, and runs
only while an installed source has dependency watching enabled.

A missed change may take up to one check interval plus normal reload
debouncing to reach the runtime under normal scheduling. A change that
reverts between checks can be missed when the native event is absent.

## Removal

Remove the periodic check when the supported macOS watch adapter can
provide continuous coverage across registration changes. Qualify its
replacement with scoped installs and removals during native watcher
registration and replacement.
