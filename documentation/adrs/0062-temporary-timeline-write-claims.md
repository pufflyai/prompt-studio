# Temporary timeline write claims

Proposed: 2026-10-09

## Intended design

Planner owns ticket data and timeline placement. A placement change should run as one atomic storage transaction so concurrent commands cannot overwrite another caller's changes.

## External limitation

The public extension storage API offers key-value writes and atomic collection claims, but no transaction spanning a ticket and its timeline plan. The extension cannot access the host database directly. Adding a host transaction API is outside this ticket.

## Temporary workaround

Keep atomic owner claims inside Planner's timeline commands. Claim creation excludes concurrent timeline writers; conditional deletion releases only the exact owner. Timeline placement, track creation, and ticket action writes use their own keys. This is a temporary workaround, not the intended storage design.

A ticket created before a later placement or release failure is returned with its identity and a placement error. The form retries placement on that ticket instead of creating another one.

## Limitations

A process crash can leave a claim behind. There is no timed expiry: an old writer must be stopped before an operator conditionally releases its token. Claims do not serialize unrelated Planner edits and do not make ticket creation and placement one transaction.

## Isolation

Claims live in the `timeline.write-claims` collection. The guard and recovery commands live under Planner's timeline directory. No host database state or SDK API changes are needed. Recovery is documented in [Planner's timeline guide](../../extensions/pstdio-planner/docs/0005-timeline.md).

## Removal

When the SDK provides scoped storage transactions or conditional plan replacement, replace the guard with that API, remove the recovery commands, and clear abandoned claims during the same release. Preserve the existing ticket identity on partial failures until creation and placement are atomic.
