# Ticket opening with 5,000 tickets

Updated at: 2026-11-14

PS-231 isolates the content and sidebar loaders used when opening a ticket. The
previous content lookup was already scoped, but its sidebar still loaded every
ticket, review request, and review outcome. A dependency-only blocker could also
load every ticket while opening properties.

The candidate queries indexed relationships and review requests for the selected
ticket. Children and reverse dependencies use pages of at most 100. Related titles
come from current canonical content, including shared edits. Collection indexes
are registered before commands become available; opening a ticket does not build
them for the first time.

## Isolated diagnostic

The fixture contains 5,000 tickets with 8,452-byte bodies, 5,000 review requests,
and 5,000 outcomes. It uses the production PGlite schema and record service in a
disposable memory database. Both versions use the same fixture and run the content
and sidebar loaders concurrently. Each process runs one first sample and nine
repeat samples. Database statistics are collected outside the measured interval.

| Measurement | Before | Candidate |
| --- | ---: | ---: |
| First loader sample | 233.3 ms | 17.2 ms |
| Repeat median (9 samples) | 225.6 ms | 10.1 ms |
| Repeat maximum | 271.1 ms | 14.8 ms |
| Full ticket records materialized per opening | 5,001 | 3 |
| Review requests / outcomes materialized | 5,000 / 5,000 | 1 / 1 |
| Sequential database row visits per opening | 45,000 | 0 |
| Indexed database row fetches per opening | 1 | 7 |

The repeat median decreased by 95.5%. Index installation took 2,108 ms during
fixture preparation, separately from opening. This cost belongs to extension
registration when introducing the indexes; it has not disappeared.

These are component diagnostics, not browser click-to-editor timings or a new
performance budget. Workspace lists and scoped session histories are empty in
this fixture. It does not measure network transport, rendering, runtime startup,
or projects with many linked sessions. Runs took place on the same macOS host,
with some other validation activity; they are not controlled production figures.
The diagnostic imports the matching built host SDK explicitly. An earlier run
resolved an old extension-local SDK, failed on a missing method, and timed out in
cleanup; it is retained as failed diagnostic evidence and excluded from timings.

## Reproduce

Use an unchanged Planner checkout at `2cd2f7d0eed32b4583213e2ac6c9e79145f3976d`,
the candidate Planner checkout, and the matching host/SDK producer checkout.
Install dependencies and build the producer SDK. Link that SDK into the candidate
Planner with `bun link @pstdio/sdk --no-save` after registering the producer with
`bun link` in `packages/sdk`. Do not change the installed user extension.

From the candidate checkout, run each case separately:

```sh
bun scripts/dev/ticket-opening-diagnostic.ts "$BASELINE_ROOT" before "$HOST_ROOT"
bun scripts/dev/ticket-opening-diagnostic.ts "$CANDIDATE_ROOT" after "$HOST_ROOT"
```

The script has a 60-second whole-case deadline, closes its database, checks the
selected content and review count, and prints JSON lines for preparation and all
ten samples. It never opens the user's database. Compare the first sample and
the median of indices 1–9. Keep setup time separate.

## Regression coverage and limits

`extensions/pstdio-planner/src/commands/ticket-opening-scale.p1.test.ts` rejects
whole-collection ticket/review/outcome reads at 5,000 tickets. It also covers
relationship pagination, scalar legacy dependencies, current shared titles,
cursor retention when identities are missing, malformed review requests, and
case-insensitive dependency shorthands. Host and SDK tests cover index scope
isolation and registration before the first query.

The latest broad Planner run passed 920 tests and failed 18 tests whose session
fixtures still modeled the old full-attempt capacity scan. After updating those
fixtures to the bounded live-session contract, all 33 tests in the two affected
files pass. Later archive batching changes have focused passing coverage; final
review validation and installed-runtime browser timing remain outstanding.
Board, Timeline, and the remaining automation audit are unfinished.
