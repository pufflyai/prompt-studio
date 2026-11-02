# Troubleshooting

## 1. Check existing knowledge

1. Read relevant [lessons learned](../lessons-learned/) before trying another approach.
2. Read related [architecture decision records (ADRs)](../adrs/) for design choices, constraints, and known workarounds.
3. Check each record against current code and any superseding decisions.

## 2. Find the cause

1. Reproduce the problem with the smallest useful case.
2. Separate confirmed facts from hypotheses. Use logs and measurements to test explanations.
3. Trace the failure to the layer that owns the behavior.
4. Fix the cause. Follow the [ADR rules](0008-planning.md#3-architecture-decisions) if an external limit forces a workaround.

## 3. Verify and record

1. Run the affected checks using the [testing guidance](0005-testing.md).
2. Add a lesson when a failure is likely to recur. Record hacks and temporary solutions in ADRs.
3. Report unresolved blockers with evidence and the next step needed.
