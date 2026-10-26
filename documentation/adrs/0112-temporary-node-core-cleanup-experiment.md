# Temporary Node core cleanup experiment

Proposed: 2026-10-26

Status: Diagnostic experiment, not accepted for delivery

## Intended design

The test runtime removes its own complete cold fixture before its existing 120-second allowance expires. Removal must unlink junctions without deleting their targets and finish before the test returns.

## External limitation

Awaited Bun removal exceeds the remaining allowance on actual Windows core fixtures. Synthetic Bun, Node and native comparisons do not reproduce the real tree's timing. No generic Bun defect or unavoidable external limitation has been established, so a clean solution has not been ruled out.

## Experiment

Compare standard Node 24 asynchronous recursive removal on the unchanged actual fixture. Record real tree counts and link topology, Node executable/version/architecture, whole-case phases and cleanup duration. Own the child through the test process registry and await its close event. Require ordinary-path root disappearance and an external junction-target sentinel to survive. Do not change installation, feature assertions, cold inputs, retries or allowances.

The default Node asynchronous operation also exceeded the remaining allowance on the actual 85,000-file tree. Compare Node's standard synchronous removal in an owned child against its asynchronous removal with a 64-thread I/O pool. The parent test remains asynchronous and enforces its existing deadline in both cases. Record pool selection and child peak resident memory. These measurements test library traversal overhead and bounded I/O parallelism; neither is accepted for delivery by this experiment.

## Limitations

This diagnostic adds inventory and sentinel work. It adds a Node dependency only to an experiment. It is not an accepted workaround and does not change product behavior.

## Removal

Delete this experiment after evidence is saved. Adopt no Node dependency in delivery unless the actual cold cases and resource checks pass on both architectures and review establishes why the external operation requires it. A retained workaround needs a final ADR explaining that evidence and its upstream removal gate.
