# Temporary Cloud completion and Planner release limits

Proposed: 2026-11-11

Status: Accepted. The user approved these exact values on 2026-11-11; native qualification remains required.

## Context

Release verification 43019560729 exhausted a five-second Cloud snapshot wait while the source was still applying updates and preparing compaction. Locally, all eight replacements completed in 30.2 seconds, followed by a separate five-second reset catch-up timeout. The intended test contract is eventual completion within its 120-second case allowance.

Planner cold open measured 3303/3200/2989 ms on hosted Ubuntu against 3000 ms. The same fixed workload measured 1258/1256/1224 ms locally. Two Apple Silicon Planner functional cases completed assertions at 23.5/20.7 seconds but hit 30 seconds during deletion; local deletion alone took 10.4/10.0 seconds.

## Decision

- Give completion waits in only the eight-replacement Cloud scenario 10,000 ms. Preserve its 120,000 ms whole-case allowance and all eight replacements, large values and repaired reset assertions. Other Cloud scenarios keep their existing waits.
- Temporarily set the Planner cold-open product budget to 4000 ms, about 20% above the slowest hosted sample. Keep 1000 tickets, three edits each and three cold samples.
- Give all seven functional cases sharing the packaged Planner fixture 45,000 ms on Darwin arm64. The user approved 45,000 ms and instructed increasing all limits. PR CI then exposed the same deletion bottleneck in supervisor-wake and draft-adoption cases, so the common fixture allowance is applied consistently. Other platforms retain their existing allowances.

## External limitation

Hosted CPU and filesystem costs differ from the local machine. These changes provide execution headroom and explicitly relax one product contract for the requested release window; they do not establish a runtime speed improvement. A causal optimization needs separate profiling.

## Limitations

The failed Cloud runs stopped before completion beyond five seconds could be observed. The changed scenario must pass native qualification. First-failure evidence remains in RP-575 and PS-1160; no unchanged retry is presented as a repair.

## Removal

Restore five-second Cloud waits and the 3000 ms Planner target after a causal improvement and representative native evidence on the same workload. Restore 30-second Apple Silicon fixture allowances when setup plus cleanup consistently fits them. Keep workloads, platforms and execution reports intact.
